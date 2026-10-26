import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { ensureFreeGrant } from "@/lib/credits";
import {
  getAiReplyCreditCost,
  getPlanLimits,
  REPLY_CREDIT_COSTS,
  totalAvailableCredits,
} from "@/lib/plans";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/billing/usage
// Reports the Credit Economy state: the split wallet, the credits the plan
// grants each month, and what one AI reply costs on this channel (5 credits on
// Telegram/Discord/Web Chat, 80 on WhatsApp). Manual replies are free. AI replies
// used this month are counted from the Message table so the number always
// matches the inbox.
//
// The wallet is returned as three numbers:
//   `planCredits`      — monthly plan allowance, reset on every renewal
//   `topUpCredits`     — paid top-ups, never expire
//   `creditBalance`    — the sum of both, i.e. what the AI can actually spend
// `planMonthlyCredits` is the size of the allowance the current plan grants
// (not a balance) and is what the UI advertises next to the plan name.
//
// Free tier: the allowance is re-granted lazily, so this endpoint also hands out
// the 50 Free credits when they are over 30 days old. That is what makes the
// dashboard header pills (which call this route) refresh on their own, without
// waiting for the owner to trigger an AI reply.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        id: true,
        plan: true,
        planInterval: true,
        planStatus: true,
        planExpiresAt: true,
        channel: true,
        planCredits: true,
        topUpCredits: true,
        lastFreeGrantAt: true,
        subscriptionStatus: true,
        gracePeriodEndsAt: true,
      },
    });

    // Free tier: re-grant the monthly 50 credits if they lapsed. The helper is a
    // compare-and-swap that only ever touches Free rows, so a paid plan is left
    // alone; it returns the same record with planCredits/topUpCredits refreshed.
    const wallet = await ensureFreeGrant(business);

    const [{ ai: aiRepliesUsed, manual: manualRepliesUsed }] = await prisma.$queryRaw<
      { ai: number; manual: number }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE "sender" = 'ai')::int AS ai,
        COUNT(*) FILTER (WHERE "sender" = 'agent')::int AS manual
      FROM "Message"
      WHERE "businessId" = ${businessId}
        AND "createdAt" >= date_trunc('month', now())
    `;

    const limits = getPlanLimits(business.plan, business.planInterval);

    return Response.json({
      aiRepliesUsed,
      manualMessagesUsed: manualRepliesUsed,
      // Credit Economy: 1 credit = ₦1. The split wallet is reported bucket by
      // bucket, and `creditBalance` keeps its old meaning of "spendable now".
      planCredits: wallet.planCredits,
      topUpCredits: wallet.topUpCredits,
      creditBalance: totalAvailableCredits(wallet),
      planMonthlyCredits: limits.credits,
      aiCreditCost: getAiReplyCreditCost(business.channel),
      manualCreditCost: REPLY_CREDIT_COSTS.manual,
      plan: business.plan,
      planInterval: business.planInterval,
      planStatus: business.planStatus,
      planExpiresAt: business.planExpiresAt,
      channel: business.channel,
      subscriptionStatus: business.subscriptionStatus,
      gracePeriodEndsAt: business.gracePeriodEndsAt,
    });
  } catch (error) {
    console.error("[GET /api/billing/usage]", error);
    return Response.json(
      {
        error: "Failed to load usage",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}