import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";

type LeaderboardEntry = {
  agentNumber: string;
  fullName: string;
  referrals: number;
  totalCommission: number;
};

// GET /api/agents/leaderboard
// Top 5 agents for the current calendar month, ranked by referral count and
// then by successful payout total.
export async function GET() {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const agents = await prisma.agent.findMany({
      select: {
        agentNumber: true,
        fullName: true,
        _count: {
          select: {
            referredBusinesses: {
              where: { createdAt: { gte: monthStart } },
            },
          },
        },
        payouts: {
          where: {
            status: "success",
            createdAt: { gte: monthStart },
          },
          select: { amountNaira: true },
        },
      },
    });

    const leaderboard: LeaderboardEntry[] = agents
      .map((entry) => ({
        agentNumber: entry.agentNumber,
        fullName: entry.fullName,
        referrals: entry._count.referredBusinesses,
        totalCommission: entry.payouts.reduce(
          (total, payout) => total + payout.amountNaira,
          0,
        ),
      }))
      .sort(
        (a, b) =>
          b.referrals - a.referrals ||
          b.totalCommission - a.totalCommission ||
          a.fullName.localeCompare(b.fullName),
      )
      .slice(0, 5);

    return Response.json({ leaderboard });
  } catch (error) {
    console.error("[GET /api/agents/leaderboard]", error);
    return Response.json(
      {
        error: "Failed to load leaderboard",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
