import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCreditPrice, getPlanLimits, isActivePaidPlan } from "@/lib/plans";
import { getCurrentAgent } from "@/lib/agent-auth";

export type AiEnabledResult =
  | { ok: true }
  | { ok: false; reason: "plan_expired" | "cap_hit" | "no_credits" };

/**
 * Requires only that the user is authenticated and has a business.
 * No plan check — site access, manual chat, dashboard features work regardless.
 */
export async function requireSiteAccess(businessId: string): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });

  if (!business) {
    const agent = await getCurrentAgent();
    if (agent) {
      redirect("/agents/dashboard");
    }

    throw new Error("Business not found");
  }
}

/**
 * Checks if AI auto-reply should be enabled for this business.
 * Returns ok=true if:
 * - Plan is active paid AND messagesUsedThisMonth < includedMsgs, OR
 * - the Naira wallet can cover at least one AI reply
 * Otherwise returns ok=false with reason.
 */
export async function requireAiEnabled(businessId: string): Promise<AiEnabledResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      plan: true,
      planStatus: true,
      planInterval: true,
      planExpiresAt: true,
      onboardingEndsAt: true,
      channel: true,
      creditWalletBalanceNaira: true,
      messagesUsedThisMonth: true,
      messagesResetAt: true,
      aiEnabled: true,
      subscriptionStatus: true,
      gracePeriodEndsAt: true,
    },
  });

  if (!business) {
    return { ok: false, reason: "plan_expired" };
  }

  // If AI is manually disabled by owner, respect that
  if (!business.aiEnabled) {
    return { ok: false, reason: "plan_expired" };
  }

  // Automated dunning: a failed subscription charge keeps the AI replying
  // during the grace period, then stops it once that period lapses.
  if (business.subscriptionStatus === "past_due") {
    const graceEndsAt = business.gracePeriodEndsAt;
    if (!graceEndsAt || graceEndsAt.getTime() <= Date.now()) {
      return { ok: false, reason: "plan_expired" };
    }
  }

  // Check monthly reset
  const now = new Date();
  if (business.messagesResetAt && business.messagesResetAt < now) {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        messagesUsedThisMonth: 0,
        messagesResetAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    // After reset, re-check with fresh values
    business.messagesUsedThisMonth = 0;
    business.messagesResetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // Active paid plan
  const activePaidPlan = isActivePaidPlan(business);

  // Active trial
  const isTrialActive =
    business.planStatus === "trialing" &&
    business.onboardingEndsAt &&
    business.onboardingEndsAt > now;

  // What one AI reply over the cap costs out of the Naira wallet.
  const aiCreditPrice = getCreditPrice(business, "ai");

  if (activePaidPlan || isTrialActive) {
    const limits = getPlanLimits(business.plan, business.planInterval, business.channel);
    const included = limits.includedMsgs;

    if (business.messagesUsedThisMonth < included) {
      return { ok: true };
    }

    // Cap hit — the wallet must cover at least one more reply
    if (business.creditWalletBalanceNaira >= aiCreditPrice) {
      return { ok: true };
    }

    return { ok: false, reason: "cap_hit" };
  }

  // Free/expired plan — the wallet must cover the reply
  if (business.creditWalletBalanceNaira >= aiCreditPrice) {
    return { ok: true };
  }

  return { ok: false, reason: isTrialActive ? "cap_hit" : "plan_expired" };
}