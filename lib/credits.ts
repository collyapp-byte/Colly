// Free-tier credit bookkeeping.
//
// The permanent Free plan grants 80 credits every 30 days, but the grant is
// lazy — nothing runs on a schedule. The allowance is refreshed by the first
// wallet read after the window lapses: the chat engine (via `requireAiEnabled`)
// or the dashboard's `/api/billing/usage` call, so the header pills and billing
// pages refresh even when the AI has not been used at all.
//
// The same module demotes a paid plan whose paid period has ended back to Free
// (`downgradeExpiredPlan`), so a cancelled or lapsed subscription cannot keep
// paid-tier access forever.

import { prisma } from "@/lib/prisma";
import { FREE_PLAN_LIMITS } from "@/lib/plans";

/** How long the Free tier's allowance lasts before it is handed out again. */
const FREE_GRANT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Plans that read as the Free tier; `trial` is the retired name for it. */
const FREE_PLAN_NAMES = ["free", "trial"];

/**
 * The wallet fields a Free re-grant touches. Structural on purpose: any
 * `Business` select that includes these columns can be passed in, so the same
 * helper serves the chat engine and the billing API.
 */
export type BusinessCreditRecord = {
  id: string;
  plan: string;
  planCredits: number;
  topUpCredits: number;
  lastFreeGrantAt: Date | null;
};

/**
 * Re-grants the Free tier's 80 credits when the current allowance is more than
 * 30 days old, and returns the same record with the fresh balance. It mutates
 * the record in place (`planCredits`) so callers keep using their own snapshot,
 * and it returns it so callers can also write `const fresh = await ...`.
 *
 * The allowance is REPLACED, not added to: unused credits never roll over, and
 * `topUpCredits` (paid for by the business) is never touched. Paid plans are
 * skipped entirely — their allowance is re-granted by the Paystack charge.
 */
export async function ensureFreeGrant<T extends BusinessCreditRecord>(
  business: T,
): Promise<T> {
  const grantIsDue =
    FREE_PLAN_NAMES.includes(business.plan) &&
    (!business.lastFreeGrantAt ||
      business.lastFreeGrantAt.getTime() < Date.now() - FREE_GRANT_INTERVAL_MS);

  if (!grantIsDue) {
    return business;
  }

  // Mutated in place; the generic `T` only keeps the caller's extra fields.
  const wallet: BusinessCreditRecord = business;
  const thirtyDaysAgo = new Date(Date.now() - FREE_GRANT_INTERVAL_MS);

  // Compare-and-swap on `plan` plus the stale stamp, so a paid upgrade (or a
  // re-grant by a concurrent request) that lands between the caller's read and
  // this write is never clobbered back to the Free allowance.
  const granted = await prisma.business.updateMany({
    where: {
      id: business.id,
      plan: { in: FREE_PLAN_NAMES },
      OR: [
        { lastFreeGrantAt: null },
        { lastFreeGrantAt: { lt: thirtyDaysAgo } },
      ],
    },
    data: {
      planCredits: FREE_PLAN_LIMITS.credits,
      lastFreeGrantAt: new Date(),
    },
  });

  if (granted.count > 0) {
    wallet.planCredits = FREE_PLAN_LIMITS.credits;
    return business;
  }

  // Someone else got there first (or the plan changed mid-check): trust the row
  // over the caller's stale snapshot.
  const fresh = await prisma.business.findUnique({
    where: { id: business.id },
    select: { planCredits: true, topUpCredits: true },
  });
  if (fresh) {
    wallet.planCredits = fresh.planCredits;
    wallet.topUpCredits = fresh.topUpCredits;
  }

  return business;
}

/**
 * The fields plan expiry is decided on. Structural on purpose, so any `Business`
 * select that includes these columns can be passed in.
 */
export type BusinessPlanRecord = {
  id: string;
  plan: string;
  planStatus: string;
  planExpiresAt: Date | null;
  planCredits: number;
  topUpCredits: number;
  lastFreeGrantAt: Date | null;
  subscriptionStatus: string | null;
  gracePeriodEndsAt: Date | null;
};

/**
 * Downgrades a paid plan whose paid period has ended back to the permanent Free
 * tier, and grants the Free 80 credits.
 *
 * Nothing else ever demotes a business: a Paystack cancellation or a lapsed
 * subscription only rewrites `planStatus` ("cancelled" / "expired" / "past_due"),
 * so without this a business could keep the paid tier — and its paid allowance —
 * forever. `requireAiEnabled()` (lib/auth-guards.ts) runs it BEFORE any gate, so
 * the AI is judged on the plan the business is actually entitled to.
 *
 * Four conditions must all hold, otherwise the business is left alone:
 *  - it is not already Free (`free`/`trial`),
 *  - `planStatus` is not "active" — an active subscription is a live one; if the
 *    renewal webhook is late the business keeps its paid access until Paystack
 *    says otherwise (never cut off a paying customer over a missed webhook),
 *  - `planExpiresAt` is in the past — the period they already paid for is over,
 *  - and, for `past_due`, the dunning grace window has also lapsed, so a customer
 *    inside their grace period keeps their paid allowance while the retry runs.
 *
 * The write is a compare-and-swap on the tier/status that was read: a renewal or
 * upgrade landing concurrently (the webhook rewrites `plan` and `planStatus`)
 * makes the update match 0 rows and the fresh row wins. `topUpCredits` (paid for
 * by the business) is never touched; the paid `planCredits` allowance is replaced
 * by the Free grant, exactly like any month's allowance being overwritten.
 */
export async function downgradeExpiredPlan<T extends BusinessPlanRecord>(
  business: T,
): Promise<T> {
  if (FREE_PLAN_NAMES.includes(business.plan)) {
    return business;
  }

  const now = new Date();

  if (business.planStatus === "active") {
    return business;
  }

  if (!business.planExpiresAt || business.planExpiresAt.getTime() > now.getTime()) {
    return business;
  }

  const inDunningGrace =
    business.subscriptionStatus === "past_due" &&
    business.gracePeriodEndsAt !== null &&
    business.gracePeriodEndsAt.getTime() > now.getTime();

  if (inDunningGrace) {
    return business;
  }

  const downgraded = await prisma.business.updateMany({
    where: {
      id: business.id,
      // Compare-and-swap: still the tier and status this call read.
      plan: business.plan,
      planStatus: business.planStatus,
      planExpiresAt: { lt: now },
    },
    data: {
      plan: "free",
      planStatus: "inactive",
      // The Free allowance replaces the lapsed plan's leftover credits; nothing
      // rolls over, and top-ups are untouched.
      planCredits: FREE_PLAN_LIMITS.credits,
      lastFreeGrantAt: now,
      // A lapsed subscription must not also stay flagged as dunning, or the
      // past_due gate below would keep blocking the AI despite the Free grant.
      subscriptionStatus: "inactive",
      paymentFailedAt: null,
      gracePeriodEndsAt: null,
    },
  });

  if (downgraded.count === 0) {
    // A renewal, an upgrade or another request got there first: trust the row.
    const fresh = await prisma.business.findUnique({
      where: { id: business.id },
      select: {
        plan: true,
        planStatus: true,
        planExpiresAt: true,
        planCredits: true,
        topUpCredits: true,
        lastFreeGrantAt: true,
        subscriptionStatus: true,
        gracePeriodEndsAt: true,
      },
    });

    if (fresh) {
      Object.assign(business, fresh);
    }

    return business;
  }

  console.log(
    `[credits] downgraded business ${business.id} (${business.plan} -> free): paid period ended ${business.planExpiresAt.toISOString()}`,
  );

  Object.assign(business, {
    plan: "free",
    planStatus: "inactive",
    planCredits: FREE_PLAN_LIMITS.credits,
    lastFreeGrantAt: now,
    subscriptionStatus: "inactive",
    gracePeriodEndsAt: null,
  });

  return business;
}
