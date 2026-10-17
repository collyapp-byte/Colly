import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";
import { isCourseSlug } from "@/lib/course-badge-meta";
import { badgeDownloadHeaders, badgeSvgPath } from "@/lib/badge-assets";

/**
 * Downloads an earned course badge as the original SVG.
 *
 * Same gating as the PNG route: only the agent who earned the badge may download
 * it (401 unauthenticated, 403 when not earned).
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

    return new Response(new Uint8Array(svg), {
      headers: badgeDownloadHeaders(courseSlug, "svg"),
    });
  } catch (error) {
    console.error("[GET /api/agents/badges/[courseSlug]/svg]", error);
    return Response.json(
      { error: "Failed to load the badge image" },
      { status: 500 },
    );
  }
}
