import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getMonthlyCredits, totalAvailableCredits } from "@/lib/plans";
import {
  fetchSubscription,
  verifyTransaction,
  type VerifyTransactionData,
} from "@/lib/paystack";

/** Paystack's verify payload, plus the optional subscription object. */
type VerifyData = VerifyTransactionData & {
  subscription?: { code: string } | null;
};

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

/** Adds `days` to `date`, aligned to the end-ish of that day. */
function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// POST /api/billing/verify
// Confirms a checkout that just came back through the Paystack callback URL.
// On success the pending Transaction is marked paid and the wallet is applied:
// a subscription charge OVERWRITES `planCredits` with the plan's monthly grant,
// and a top-up ADD its credits to `topUpCredits` (Credit Economy: 1 credit =
// ₦1). Idempotent: an already-finalized transaction is left alone.
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    const body = await request.json().catch(() => null);
    const reference = typeof body?.reference === "string" ? body.reference : "";

    if (!reference) {
      return Response.json(
        { error: "reference is required" },
        { status: 400 },
      );
    }

    const data = (await verifyTransaction(reference)) as VerifyData;
    const transaction = await prisma.transaction.findFirst({
      where: { reference, businessId: user.businessId },
    });

    if (!transaction) {
      return Response.json(
        { error: "No transaction for this reference" },
        { status: 404 },
      );
    }

    let plan = transaction.plan;
    let wallet = await getWallet(user.businessId);

    // Already fulfilled (e.g. the webhook beat this browser callback): the
    // payment is confirmed, so report success without re-applying anything.
    // Without this, the fall-through below would return ok:false and the client
    // would show a false "could not be confirmed" error.
    if (data.status === "success" && transaction.status === "success") {
      return Response.json({ ok: true, plan, ...wallet });
    }

    if (data.status === "success" && transaction.status === "pending") {
      // Idempotency guard (BUG 2): atomically flip this transaction from
      // "pending" to "success". Only the first caller (verify or the webhook)
      // wins the claim; a repeat call sees 0 rows and no-ops without touching
      // the credit balance or the plan.
      const claim = await prisma.transaction.updateMany({
        where: { id: transaction.id, status: "pending" },
        data: {
          status: "success",
          paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
          channel: data.channel ?? null,
        },
      });

      if (claim.count === 0) {
        // Already fulfilled by the webhook (or a prior verify call).
        wallet = await getWallet(user.businessId);
        return Response.json({ ok: true, plan, ...wallet });
      }

      if (transaction.type === "subscription") {
        const interval = transaction.planInterval === "yearly" ? "yearly" : "monthly";
        await prisma.business.update({
          where: { id: user.businessId },
          data: {
            plan: transaction.plan ?? undefined,
            planInterval: interval,
            planStatus: "active",
            planStartedAt: new Date(),
            planExpiresAt: addDays(
              new Date(),
              interval === "yearly" ? 365 : 30,
            ),
            // Credit Economy: the plan's TOTAL grant fills the monthly bucket
            // (baseCredits plus the bonus WhatsApp credits: Green 23,000, Blue
            // 44,000, Black 100,000) — monthly and yearly alike. It is SET, not
            // incremented, so an allowance that was not fully spent last month
            // cannot be hoarded. `topUpCredits` (paid credits) is left alone.
            planCredits: getMonthlyCredits(transaction.plan),
            paystackCustomerCode:
              data.customer?.customer_code ?? undefined,
            billingEmail: data.customer?.email ?? user.email,
          },
        });

        plan = transaction.plan;

        // If the verify payload already carries the subscription code, persist
        // it and capture the email token needed for pause/resume.
        const subscriptionCode = data.subscription?.code;
        if (subscriptionCode) {
          let emailToken = null;
          try {
            const subscription = await fetchSubscription(subscriptionCode);
            emailToken = subscription.email_token ?? null;
          } catch {
            // Email token is fetched again by later subscription.create
            // webhooks; a failure here must not undo the upgrade.
          }

          await prisma.business.update({
            where: { id: user.businessId },
            data: {
              paystackSubscriptionCode: subscriptionCode,
              paystackEmailToken: emailToken ?? undefined,
            },
          });
        }

        wallet = await getWallet(user.businessId);
        return Response.json({ ok: true, plan, ...wallet });
      }

      // Credit top-ups: ADD the credits that were bought (1 credit = ₦1) to the
      // permanent bucket. Top-ups never expire, so a renewal later on only
      // resets `planCredits` and leaves this balance untouched. The Transaction
      // row is authoritative; the paid amount is the fallback for rows created
      // before credits were recorded.
      await prisma.business.update({
        where: { id: user.businessId },
        data: {
          topUpCredits: {
            increment:
              transaction.creditsPurchased ?? Number(transaction.amount),
          },
        },
      });

      wallet = await getWallet(user.businessId);
      return Response.json({ ok: true, plan, ...wallet });
    }

    // Not a successful, pending payment (already handled, abandoned, failed...).
    return Response.json({ ok: false, plan, ...wallet });
  } catch (error) {
    console.error("[POST /api/billing/verify]", error);
    return Response.json(
      {
        error: "Failed to verify payment",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * The split wallet as the client needs it: both buckets plus their total, so a
 * caller can report "spendable now" without re-deriving the rule.
 */
type WalletResponse = {
  /** Monthly plan allowance; reset on every renewal. */
  planCredits: number;
  /** Paid top-ups; never expire. */
  topUpCredits: number;
  /** `planCredits + topUpCredits` — what the AI can actually spend. */
  creditBalance: number;
};

async function getWallet(businessId: string): Promise<WalletResponse> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { planCredits: true, topUpCredits: true },
  });

  return {
    planCredits: business.planCredits,
    topUpCredits: business.topUpCredits,
    creditBalance: totalAvailableCredits(business),
  };
}