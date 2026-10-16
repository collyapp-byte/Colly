import { getCurrentAgent } from "@/lib/agent-auth";
import { getAgentBadges, hasAllBadges } from "@/lib/badges";

/**
 * Badge status for the signed-in agent: earned state per badge-eligible
 * course, plus whether all four badges are earned.
 */
export async function GET(): Promise<Response> {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const [badges, allEarned] = await Promise.all([
      getAgentBadges(agent.id),
      hasAllBadges(agent.id),
    ]);

    return Response.json({
      badges: badges.map((badge) => ({
        courseSlug: badge.courseSlug,
        earned: badge.earned,
        earnedAt: badge.earnedAt,
      })),
      allEarned,
    });
  } catch (error) {
    console.error("[GET /api/agents/badges]", error);
    return Response.json(
      {
        error: "Failed to load badges",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
