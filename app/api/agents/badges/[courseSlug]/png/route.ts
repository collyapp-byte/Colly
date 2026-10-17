import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";
import { isCourseSlug } from "@/lib/course-badge-meta";
import { badgeDownloadHeaders, badgeSvgPath } from "@/lib/badge-assets";

/**
 * Downloads an earned course badge as a 500x500 PNG.
 *
 * Only the agent who earned the badge can download it: the badge must exist for
 * the signed-in agent, so a not-yet-earned badge is forbidden (403). The static
 * SVG is rasterised at request time.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseSlug: string }> },
) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const { courseSlug } = await params;
    if (!isCourseSlug(courseSlug)) {
      return Response.json({ error: "Unknown badge" }, { status: 404 });
    }

    const earned = await prisma.agentBadge.findUnique({
      where: { agentId_courseSlug: { agentId: agent.id, courseSlug } },
      select: { id: true },
    });
    if (!earned) {
      return Response.json(
        { error: "You have not earned this badge yet." },
        { status: 403 },
      );
    }

    const svg = await readFile(badgeSvgPath(courseSlug));
    const png = await svgToPng(svg);

    if (!png) {
      // Neither rasteriser is available; report it so the client can fall back
      // to the SVG download rather than silently serving a broken PNG.
      return Response.json(
        {
          error: "PNG generation is unavailable on this deployment.",
          svg: `/api/agents/badges/${courseSlug}/svg`,
        },
        { status: 501 },
      );
    }

    return new Response(new Uint8Array(png), {
      headers: badgeDownloadHeaders(courseSlug, "png"),
    });
  } catch (error) {
    console.error("[GET /api/agents/badges/[courseSlug]/png]", error);
    return Response.json(
      { error: "Failed to build the badge image" },
      { status: 500 },
    );
  }
}

/**
 * Rasterises an SVG string to a 500x500 PNG. Tries `sharp` (present as a
 * transitive dependency of Next) and falls back to `@resvg/resvg-js`. Returns
 * null when neither module can be loaded/used, so the caller can report it.
 */
async function svgToPng(svg: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(svg).resize(500, 500).png().toBuffer();
  } catch (error) {
    console.warn(
      "[badges/png] sharp unavailable, trying @resvg/resvg-js:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    // Build the specifier at runtime so the bundler treats this as an optional
    // dynamic import instead of trying to resolve a package that may not exist.
    const spec = ["@resvg", "resvg-js"].join("/");
    const { Resvg } = await import(spec);
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 500 } });
    return Buffer.from(resvg.render().asPng());
  } catch (error) {
    console.warn(
      "[badges/png] @resvg/resvg-js unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  return null;
}
