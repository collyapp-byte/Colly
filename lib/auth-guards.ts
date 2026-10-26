import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  FREE_PLAN_LIMITS,
  getAiReplyCreditCost,
  totalAvailableCredits,
} from "@/lib/plans";
import { getCurrentAgent } from "@/lib/agent-auth";

/**
 * How long the Free tier's allowance lasts before it is handed out again. The
 * re-grant is lazy — it runs on the next AI check — so the permanent Free plan
 * needs no scheduler and no cron job.
 */
const FREE_GRANT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Plans that read as the Free tier; `trial` is the retired name for it. */
const FREE_PLAN_NAMES = ["free", "trial"];

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
 * Free tier: this is also where the permanent Free plan is re-granted. Its 50
 * credits are a monthly allowance, so once `lastFreeGrantAt` is more than 30
 * days old the wallet is reset to 50 before any of the checks below run. No
 * scheduler is involved and the owner has nothing to click.
 */
export async function requireAiEnabled(businessId: string): Promise<AiEnabledResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      channel: true,
      plan: true,
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

  // Permanent Free tier: 50 credits every 30 days, handed out lazily on the
  // first AI check after the window lapses. This runs before every early return
  // below so a Free business whose AI is paused still gets its allowance
  // refreshed — the dashboard and the chat engine read the same row.
  const grantIsDue =
    FREE_PLAN_NAMES.includes(business.plan) &&
    (!business.lastFreeGrantAt ||
      business.lastFreeGrantAt.getTime() < Date.now() - FREE_GRANT_INTERVAL_MS);

  if (grantIsDue) {
    const thirtyDaysAgo = new Date(Date.now() - FREE_GRANT_INTERVAL_MS);
    // The write is a compare-and-swap on `plan` plus the stale stamp, so a paid
    // upgrade (or a re-grant by a concurrent message) that lands between the
    // read above and this write is never clobbered back to the Free allowance.
    const granted = await prisma.business.updateMany({
      where: {
        id: businessId,
        plan: { in: FREE_PLAN_NAMES },
        OR: [
          { lastFreeGrantAt: null },
          { lastFreeGrantAt: { lt: thirtyDaysAgo } },
        ],
      },
      data: {
        // The allowance is replaced, not topped up: top-up credits were paid for
        // and are never touched here.
        planCredits: FREE_PLAN_LIMITS.credits,
        lastFreeGrantAt: new Date(),
      },
    });

    if (granted.count > 0) {
      // Keep the local snapshot in step so the checks below spend the fresh
      // balance instead of the drained one.
      business.planCredits = FREE_PLAN_LIMITS.credits;
    } else {
      // Someone else got there first (or the plan changed mid-check): trust the
      // row over this stale snapshot.
      const fresh = await prisma.business.findUnique({
        where: { id: businessId },
        select: { planCredits: true, topUpCredits: true },
      });
      if (fresh) {
        business.planCredits = fresh.planCredits;
        business.topUpCredits = fresh.topUpCredits;
      }
    }
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