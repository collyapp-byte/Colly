import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { getAiReplyCreditCost, getPlanLimits, REPLY_CREDIT_COSTS } from "@/lib/plans";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/billing/usage
// Reports the Credit Economy state: the current credit balance, the credits the
// plan grants each month, and what one AI reply costs on this channel (5
// credits on Telegram/Discord/Web Chat, 40 on WhatsApp). Manual replies are
// free. AI replies used this month are counted from the Message table so the
// number always matches the inbox.
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
        trialEndsAt: true,
        channel: true,
        creditBalance: true,
        aiMessagesUsed: true,
        manualMessagesUsed: true,
        subscriptionStatus: true,
        gracePeriodEndsAt: true,
      },
    });

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
      // Credit Economy: 1 credit = ₦1.
      creditBalance: business.creditBalance,
      planCredits: limits.credits,
      aiCreditCost: getAiReplyCreditCost(business.channel),
      manualCreditCost: REPLY_CREDIT_COSTS.manual,
      plan: business.plan,
      planInterval: business.planInterval,
      planStatus: business.planStatus,
      planExpiresAt: business.planExpiresAt,
      channel: business.channel,
      // The 7-day trial window; `onboardingEndsAt` is the fallback for rows
      // created before the trial column existed.
      trialEndsAt: business.trialEndsAt ?? business.onboardingEndsAt,
      // Replies spent during the trial.
      trialAiMessagesUsed: business.aiMessagesUsed,
      trialManualMessagesUsed: business.manualMessagesUsed,
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