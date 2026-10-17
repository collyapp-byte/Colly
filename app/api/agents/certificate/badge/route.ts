import { getCurrentAgent } from "@/lib/agent-auth";
import { renderAgentCertificationBadgeSvg } from "@/lib/agent-certification-badge";
import {
  certificationBadgeHeaders,
  collyLogoDataUri,
} from "@/lib/badge-assets";

/**
 * Downloads the signed-in agent's "Certified Agent" badge for sharing (e.g. on
 * LinkedIn). Defaults to a 500x500 PNG; pass `?format=svg` for the vector.
 *
 * Gated on certification: a signed-in agent who has not passed the final exam
 * gets a 403, so only certified agents can download the badge.
 */
export async function GET(request: Request) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }
    if (agent.certifiedAt === null) {
      return Response.json(
        { error: "You are not certified yet." },
        { status: 403 },
      );
    }

    const format =
      new URL(request.url).searchParams.get("format") === "svg" ? "svg" : "png";

    const logoSrc = await collyLogoDataUri();
    const svg = renderAgentCertificationBadgeSvg({
      fullName: agent.fullName,
      year: new Date().getFullYear(),
      logoSrc,
    });

    if (format === "svg") {
      return new Response(svg, {
        headers: certificationBadgeHeaders(agent.agentNumber, "svg"),
      });
    }

    const png = await svgToPng(svg);
    if (!png) {
      // Neither rasteriser is available; let the client fall back to the SVG.
      return Response.json(
        {
          error: "PNG generation is unavailable on this deployment.",
          svg: "/api/agents/certificate/badge?format=svg",
        },
        { status: 501 },
      );
    }

    return new Response(new Uint8Array(png), {
      headers: certificationBadgeHeaders(agent.agentNumber, "png"),
    });
  } catch (error) {
    console.error("[GET /api/agents/certificate/badge]", error);
    return Response.json(
      { error: "Failed to build the badge image" },
      { status: 500 },
    );
  }
}

/**
 * Rasterises the badge SVG to a 500x500 PNG. Tries `sharp` and falls back to
 * `@resvg/resvg-js`; returns null when neither can be used.
 */
async function svgToPng(svg: string): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(Buffer.from(svg)).resize(500, 500).png().toBuffer();
  } catch (error) {
    console.warn(
      "[certificate/badge] sharp unavailable, trying @resvg/resvg-js:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    // Built at runtime so the bundler treats resvg as an optional dependency.
    const spec = ["@resvg", "resvg-js"].join("/");
    const { Resvg } = await import(spec);
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 500 } });
    return Buffer.from(resvg.render().asPng());
  } catch (error) {
    console.warn(
      "[certificate/badge] @resvg/resvg-js unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  return null;
}
