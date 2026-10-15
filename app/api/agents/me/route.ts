import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";

/**
 * Dashboard summary for the signed-in agent: training progress, certification
 * status, and the businesses they referred.
 */
export async function GET() {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const [totalLessons, completedLessons, referrals] = await Promise.all([
      prisma.agentLesson.count({
        where: { course: { published: true } },
      }),
      prisma.agentLessonProgress.count({ where: { agentId: agent.id } }),
      prisma.business.findMany({
        where: { referredByAgentId: agent.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          plan: true,
          planStatus: true,
        },
      }),
    ]);

    return Response.json({
      agent: {
        fullName: agent.fullName,
        agentNumber: agent.agentNumber,
        certifiedAt: agent.certifiedAt,
      },
      progress: {
        completedLessons,
        totalLessons,
      },
      certified: agent.certifiedAt !== null,
      referrals: referrals.map((business) => ({
        id: business.id,
        name: business.name,
        createdAt: business.createdAt,
        plan: business.plan,
        planStatus: business.planStatus,
      })),
    });
  } catch (error) {
    console.error("[GET /api/agents/me]", error);
    return Response.json(
      {
        error: "Failed to load your dashboard",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
