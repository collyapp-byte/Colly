// Free-tier credit bookkeeping.
//
// The permanent Free plan grants 50 credits every 30 days, but the grant is
// lazy — nothing runs on a schedule. The allowance is refreshed by the first
// wallet read after the window lapses: the chat engine (via `requireAiEnabled`)
// or the dashboard's `/api/billing/usage` call, so the header pills and billing
// pages refresh even when the AI has not been used at all.

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
 * Re-grants the Free tier's 50 credits when the current allowance is more than
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
