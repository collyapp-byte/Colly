import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAiReplyCreditCost, totalAvailableCredits } from "@/lib/plans";
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
 *
 * Credit Economy: the AI may reply when the business's wallet — the monthly plan
 * allowance plus permanent top-ups — covers exactly one more reply on its
 * channel: 5 credits on Telegram, Discord and Web Chat, 40 credits on WhatsApp.
 * Manual (human) replies are free, so they are never gated here. `cap_hit` stays
 * in the result union for older clients but is no longer produced: there is no
 * monthly message allowance to hit.
 */
export async function requireAiEnabled(businessId: string): Promise<AiEnabledResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      channel: true,
      planCredits: true,
      topUpCredits: true,
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

  // One AI reply must be affordable out of the wallet: the monthly plan
  // allowance first, then the top-ups that never expire.
  const replyCost = getAiReplyCreditCost(business.channel);
  if (totalAvailableCredits(business) < replyCost) {
    return { ok: false, reason: "no_credits" };
  }

  return { ok: true };
}