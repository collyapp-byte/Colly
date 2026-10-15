import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";

/** Businesses that signed up with this agent's ID. */
export async function GET() {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const businesses = await prisma.business.findMany({
      where: { referredByAgentId: agent.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        plan: true,
        planStatus: true,
      },
    });

    return Response.json({
      agentNumber: agent.agentNumber,
      referrals: businesses.map((business) => ({
        id: business.id,
        name: business.name,
        createdAt: business.createdAt,
        plan: business.plan,
        planStatus: business.planStatus,
      })),
    });
  } catch (error) {
    console.error("[GET /api/agents/referrals]", error);
    return Response.json(
      {
        error: "Failed to load your referrals",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
