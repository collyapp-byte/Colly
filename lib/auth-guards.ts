import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAiReplyCreditCost, totalAvailableCredits } from "@/lib/plans";
import { downgradeExpiredPlan, ensureFreeGrant } from "@/lib/credits";
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
 * channel: 5 credits on Telegram, Discord and Web Chat, 80 credits on WhatsApp.
 * Manual (human) replies are free, so they are never gated here. `cap_hit` stays
 * in the result union for older clients but is no longer produced: there is no
 * monthly message allowance to hit.
 *
 * Free tier: the permanent Free plan's 80 credits are a monthly allowance, so
 * `ensureFreeGrant()` (lib/credits.ts) resets the wallet before any of the
 * checks below run once `lastFreeGrantAt` is more than 30 days old. No scheduler
 * is involved and the owner has nothing to click; the dashboard picks up the
 * same re-grant through /api/billing/usage.
 *
 * Expiry: a paid plan whose `planExpiresAt` has passed while it is not `active`
 * (cancelled, lapsed, dunning grace over) is demoted to Free by
 * `downgradeExpiredPlan()` (lib/credits.ts) first, so a cancelled subscription
 * falls back to the Free allowance instead of keeping paid-tier access forever.
 */
export async function requireAiEnabled(businessId: string): Promise<AiEnabledResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      channel: true,
      plan: true,
      planStatus: true,
      planExpiresAt: true,
      lastFreeGrantAt: true,
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

  // A paid plan whose paid period is over (cancelled subscription, lapsed
  // renewal, dunning grace exhausted) is demoted to the permanent Free tier —
  // with its 80 credits — BEFORE any gate below reads the plan, so a lapsed
  // business is treated as Free instead of keeping paid access indefinitely.
  // The write is a compare-and-swap: a renewal landing concurrently wins.
  await downgradeExpiredPlan(business);

  // Permanent Free tier: 80 credits every 30 days, handed out lazily by the
  // first wallet read after the window lapses. `ensureFreeGrant` mutates the row
  // in place, so the checks below spend the fresh balance. It runs before every
  // early return so a Free business whose AI is paused still gets its allowance
  // refreshed — the dashboard gets the same re-grant via /api/billing/usage.
  await ensureFreeGrant(business);

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