import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plans";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/billing/usage
// Shows how many AI replies this business has used this month versus its plan
// limit, plus its Naira wallet balance and plan details. The limit comes from
// the plan config for the business's channel; the trial's 50-reply allowance
// is the limit while trialing.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        plan: true,
        planInterval: true,
        planStatus: true,
        planExpiresAt: true,
        onboardingEndsAt: true,
        channel: true,
        creditWalletBalanceNaira: true,
        manualMessagesUsedThisMonth: true,
        subscriptionStatus: true,
        gracePeriodEndsAt: true,
      },
    });

    const [{ c: aiRepliesUsed }] = await prisma.$queryRaw<{ c: number }[]>`
      SELECT COUNT(*)::int AS c
      FROM "Message"
      WHERE "businessId" = ${businessId}
        AND "sender" = 'ai'
        AND "createdAt" >= date_trunc('month', now())
    `;

    const limits = getPlanLimits(business.plan, business.planInterval, business.channel);
    const aiRepliesLimit = limits.includedMsgs;
    const includedManualMessages = limits.includedManualMessages;

    return Response.json({
      aiRepliesUsed,
      aiRepliesLimit,
      includedAiMessages: aiRepliesLimit,
      manualMessagesUsed: business.manualMessagesUsedThisMonth,
      includedManualMessages,
      creditWalletBalanceNaira: business.creditWalletBalanceNaira,
      plan: business.plan,
      planInterval: business.planInterval,
      planStatus: business.planStatus,
      planExpiresAt: business.planExpiresAt,
      channel: business.channel,
      trialEndsAt: business.onboardingEndsAt,
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