import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAlert } from "@/lib/alerts";
import { getMonthlyCredits } from "@/lib/plans";
import { sendOwnerAlert } from "@/lib/owner-alerts";
import {
  fetchSubscription,
  verifyWebhookSignature,
} from "@/lib/paystack";

// The Paystack fields Colly reads out of a webhook event. Everything else is
// ignored, so the type only needs the intersection of what the handlers touch.
type WebhookEventData = {
  reference?: string;
  channel?: string;
  paid_at?: string;
  status?: string;
  /** Amount charged, in kobo (Paystack's smallest unit). */
  amount?: number;
  email_token?: string;
  subscription_code?: string;
  metadata?: { type?: string } | null;
  plan?: { plan_code?: string; interval?: string; name?: string } | null;
  customer?: { customer_code?: string; email?: string } | null;
  subscription?: { subscription_code?: string } | null;
  transaction?: {
    channel?: string;
    paid_at?: string;
    status?: string;
    reference?: string;
  } | null;
  invoice?: {
    paid?: boolean;
    paid_at?: string;
    transaction?: { reference?: string };
  } | null;
};

type WebhookEvent = { event: string; data: WebhookEventData };

/** Length of the dunning grace period, in days, before the AI stops. */
const GRACE_PERIOD_DAYS = 3;

/**
 * Maps a webhook event back to a Business. The subscriber's Paystack customer
 * code is the most reliable link; the owner email (from the User table) and
 * then the stored billing email cover the first payment, before the customer
 * code is saved. The subscription code is the last resort (subscription-only
 * events, e.g. invoice.update, may carry no customer object).
 */
async function findBusinessId(
  data: WebhookEventData,
): Promise<string | null> {
  const customerCode = data.customer?.customer_code;
  const customerEmail = data.customer?.email;

  if (customerCode) {
    const byCode = await prisma.business.findFirst({
      where: { paystackCustomerCode: customerCode },
      select: { id: true },
    });
    if (byCode) return byCode.id;
  }

  if (customerEmail) {
    const byOwner = await prisma.user.findFirst({
      where: { email: customerEmail },
      select: { businessId: true },
    });
    if (byOwner) return byOwner.businessId;

    const byBilling = await prisma.business.findFirst({
      where: { billingEmail: customerEmail },
      select: { id: true },
    });
    if (byBilling) return byBilling.id;
  }

  const subscriptionCode =
    data.subscription?.subscription_code ?? data.subscription_code;
  if (subscriptionCode) {
    const bySubscription = await prisma.business.findFirst({
      where: { paystackSubscriptionCode: subscriptionCode },
      select: { id: true },
    });
    if (bySubscription) return bySubscription.id;
  }

  return null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Map a Paystack interval string onto the two billing periods Colly sells. */
function normalizeInterval(value?: string | null): "monthly" | "yearly" {
  const normalised = (value ?? "").toLowerCase();
  return normalised === "yearly" ||
    normalised === "annual" ||
    normalised === "annually"
    ? "yearly"
    : "monthly";
}

/**
 * Grants one paid period of a subscription: clears the dunning state, pushes
 * `planExpiresAt` out by one interval, OVERWRITES the monthly allowance with the
 * tier's grant (Split Wallet: allowance left over from last month must not pile
 * up, and `topUpCredits` — credits the business paid for — is never touched) and
 * pays the referring agent's 15% commission while the 12-month window is open.
 *
 * Shared by the first payment (`charge.success` with a local Transaction row)
 * and by renewals, which get their row from `recordRenewal`.
 */
async function applySubscriptionPeriod({
  businessId,
  plan,
  interval,
  amountNaira,
  db = prisma,
}: {
  businessId: string;
  /** Tier to grant; defaults to the tier stored on the Business. */
  plan?: string | null;
  interval?: string | null;
  /** Amount actually charged for this period, in Naira (0 when unknown). */
  amountNaira: number;
  /** Pass a transaction client to make the grant atomic with the caller's writes. */
  db?: Prisma.TransactionClient;
}): Promise<void> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      plan: true,
      planInterval: true,
      referredByAgentId: true,
      commissionEndsAt: true,
    },
  });
  if (!business) return;

  const tier = plan ?? business.plan;
  const period = normalizeInterval(interval ?? business.planInterval);
  const monthlyCredits = getMonthlyCredits(tier);

  await db.business.update({
    where: { id: businessId },
    data: {
      planStatus: "active",
      subscriptionStatus: "active",
      paymentFailedAt: null,
      gracePeriodEndsAt: null,
      planExpiresAt: addDays(new Date(), period === "yearly" ? 365 : 30),
      ...(monthlyCredits > 0 ? { planCredits: monthlyCredits } : {}),
    },
  });

  // Pay the referring agent 15% for up to 12 months from signup.
  if (
    business.referredByAgentId &&
    business.commissionEndsAt &&
    new Date() < business.commissionEndsAt &&
    amountNaira > 0
  ) {
    const commissionNaira = Math.floor(amountNaira * 0.15);
    if (commissionNaira > 0) {
      await db.agent.update({
        where: { id: business.referredByAgentId },
        data: { commissionBalanceNaira: { increment: commissionNaira } },
      });
    }
  }
}

/**
 * Records a recurring subscription charge and grants the period it paid for.
 *
 * Renewals are billed by Paystack against the saved card and never pass through
 * our checkout, so they have no `Transaction` row — which is exactly why the old
 * `claim.count === 0` guard discarded every renewal. The Paystack reference
 * becomes the row's unique key, so a webhook retry (or the sibling
 * `invoice.update` event) can only ever grant credits and pay commission once.
 *
 * Returns false when the charge was already recorded.
 */
async function recordRenewal({
  businessId,
  reference,
  amountNaira,
  channel,
  paidAt,
  interval,
}: {
  businessId: string;
  reference: string;
  amountNaira: number;
  channel: string | null;
  paidAt: Date;
  interval?: string | null;
}): Promise<boolean> {
  try {
    // Recording the charge and granting the paid period are one atomic unit: if
    // the grant failed on its own, the unique reference would be burnt and a
    // webhook retry would see P2002 and never grant anything.
    return await prisma.$transaction(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
        select: { plan: true, planInterval: true },
      });
      if (!business) return false;

      const period = normalizeInterval(interval ?? business.planInterval);

      await tx.transaction.create({
        data: {
          businessId,
          reference,
          amount: amountNaira,
          status: "success",
          type: "subscription",
          plan: business.plan,
          planInterval: period,
          channel,
          paidAt,
        },
      });

      await applySubscriptionPeriod({
        businessId,
        plan: business.plan,
        interval: period,
        amountNaira,
        db: tx,
      });

      return true;
    });
  } catch (error) {
    // Unique `reference` → this payment was already recorded (a retry, or the
    // matching `invoice.update`/`charge.success` event). Nothing left to grant.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

// POST /api/billing/webhook
// Paystack pushes transaction and subscription state changes here. The body
// must be verified before anything is trusted. Handler: acknowledge events
// 200 even when the business could not be found; only a bad signature gets 401.
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature") ?? "";

    if (!verifyWebhookSignature(rawBody, signature)) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as WebhookEvent;
    console.info(`[billing] webhook: ${event.event}`);
    const data = event.data;

    switch (event.event) {
      case "charge.success": {
        const reference =
          data.reference ?? data.transaction?.reference ?? "";
        if (!reference) break;

        const transaction = await prisma.transaction.findUnique({
          where: { reference },
        });

        // Renewals have no local Transaction row: only our checkout route
        // creates those, and Paystack bills recurring charges against the saved
        // card. This branch must run BEFORE the pending → success claim below,
        // because that claim matches 0 rows for a renewal and the old `break`
        // dropped every renewal on the floor (no credits, no expiry extension,
        // no commission).
        if (!transaction) {
          // `data.plan` is only present on subscription charges, so an unrelated
          // one-off charge with no local row is ignored rather than guessed at.
          if (!data.plan) {
            console.warn(
              `[billing] charge.success ${reference}: no local transaction and no plan, ignored`,
            );
            break;
          }

          const businessId = await findBusinessId(data);
          if (!businessId) {
            console.warn(
              `[billing] renewal ${reference}: no business matched the charge, ignored`,
            );
            break;
          }

          await recordRenewal({
            businessId,
            reference,
            // Paystack amounts are kobo; Transaction rows store Naira.
            amountNaira:
              typeof data.amount === "number" ? data.amount / 100 : 0,
            channel: data.channel ?? data.transaction?.channel ?? null,
            paidAt: data.paid_at
              ? new Date(data.paid_at)
              : data.transaction?.paid_at
                ? new Date(data.transaction.paid_at)
                : new Date(),
            interval: data.plan.interval ?? null,
          });
          break;
        }

        // Idempotency guard (BUG 2): atomically flip this reference from
        // "pending" to "success". Only the first caller (this webhook or the
        // verify route) wins the claim; a webhook retry or a racing verify
        // sees 0 rows and no-ops, so credits are never applied twice.
        const claim = await prisma.transaction.updateMany({
          where: { reference, status: "pending" },
          data: {
            status: "success",
            paidAt: data.paid_at
              ? new Date(data.paid_at)
              : data.transaction?.paid_at
                ? new Date(data.transaction.paid_at)
                : new Date(),
            channel: data.channel ?? data.transaction?.channel ?? null,
          },
        });

        if (claim.count === 0) {
          // Already fulfilled by the verify route or a prior webhook retry.
          break;
        }

        // Credit top-ups ADD their credits to the permanent bucket (1 credit =
        // ₦1). The Transaction row's own `type` is authoritative; metadata.type
        // is the Paystack echo.
        const isCredit =
          transaction?.type === "credits" || data.metadata?.type === "credits";

        if (isCredit) {
          await prisma.business.update({
            where: { id: transaction.businessId },
            data: {
              topUpCredits: {
                increment:
                  transaction.creditsPurchased ?? Number(transaction.amount),
              },
            },
          });
        }

        // A successful subscription charge pays off any past-due balance: grant
        // the period it paid for (credits, expiry, agent commission) and clear
        // the dunning state so the AI keeps replying. `transaction` is non-null
        // here — renewals were handled above.
        const isSubscription =
          transaction.type === "subscription" ||
          data.metadata?.type === "subscription" ||
          Boolean(data.subscription_code);

        if (isSubscription) {
          await applySubscriptionPeriod({
            businessId: transaction.businessId,
            plan: transaction.plan,
            interval: transaction.planInterval ?? data.plan?.interval ?? null,
            amountNaira: Number(transaction.amount),
          });
        }
        break;
      }

      // Paystack fires `invoice.update` as a subscription invoice changes state:
      // `failed` is the canonical dunning trigger (mark the business past_due,
      // start a 3-day grace period and alert the owner), while `success` is the
      // renewal confirmation for an invoice that has just been paid.
      case "invoice.update": {
        if (data.status === "success") {
          const businessId = await findBusinessId(data);
          if (!businessId) break;

          const subscriptionCode =
            data.subscription?.subscription_code ??
            data.subscription_code ??
            "";
          const paidAtRaw = data.invoice?.paid_at ?? data.paid_at ?? null;

          // Dedupe: `charge.success` normally records the same payment first and
          // wins the unique reference. When Paystack omits the transaction
          // reference, the subscription code plus the invoice's `paid_at` is
          // deterministic across retries.
          const reference =
            data.invoice?.transaction?.reference ??
            data.transaction?.reference ??
            (subscriptionCode
              ? `invoice:${subscriptionCode}:${paidAtRaw ?? ""}`
              : "");
          if (!reference) break;

          await recordRenewal({
            businessId,
            reference,
            // Paystack amounts are kobo; Transaction rows store Naira.
            amountNaira:
              typeof data.amount === "number" ? data.amount / 100 : 0,
            channel: data.channel ?? null,
            paidAt: paidAtRaw ? new Date(paidAtRaw) : new Date(),
            interval: data.plan?.interval ?? null,
          });
          break;
        }

        if (data.status !== "failed") break;

        const businessId = await findBusinessId(data);
        if (!businessId) break;

        const gracePeriodEndsAt = new Date(
          Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
        );

        await prisma.business.update({
          where: { id: businessId },
          data: {
            subscriptionStatus: "past_due",
            planStatus: "past_due",
            paymentFailedAt: new Date(),
            gracePeriodEndsAt,
          },
        });

        await sendOwnerAlert(
          businessId,
          "⚠️ Your Colly subscription payment failed. Please update your card to avoid losing access.",
        );

        await sendAlert(
          `Subscription payment FAILED (invoice.update) for business ${businessId}. Grace period ends ${gracePeriodEndsAt.toISOString()}.`,
          "critical",
        );
        break;
      }

      case "subscription.create": {
        const code = data.subscription_code;
        if (!code) break;

        const businessId = await findBusinessId(data);
        if (!businessId) break;

        // The event usually carries the token; fetch it if it does not.
        let emailToken = data.email_token ?? null;
        if (!emailToken) {
          try {
            const subscription = await fetchSubscription(code);
            emailToken = subscription.email_token ?? null;
          } catch {
            // Best-effort: later renewal events re-sync state.
          }
        }

        await prisma.business.update({
          where: { id: businessId },
          data: {
            paystackSubscriptionCode: code,
            paystackEmailToken: emailToken ?? null,
          },
        });
        break;
      }

      case "subscription.not_renew": {
        const businessId = await findBusinessId(data);
        if (!businessId) break;

        await prisma.business.update({
          where: { id: businessId },
          data: {
            planStatus: "cancelled",
            subscriptionStatus: "canceled",
            gracePeriodEndsAt: null,
          },
        });
        break;
      }

      // Legacy aliases for the same failure/`invoice.update` flow above; kept so
      // older Paystack subscriptions still start the dunning grace period.
      case "charge.failed":
      case "invoice.payment_failed": {
        const businessId = await findBusinessId(data);
        if (!businessId) break;

        const gracePeriodEndsAt = new Date(
          Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
        );

        await prisma.business.update({
          where: { id: businessId },
          data: {
            planStatus: "past_due",
            subscriptionStatus: "past_due",
            paymentFailedAt: new Date(),
            gracePeriodEndsAt,
          },
        });

        await sendOwnerAlert(
          businessId,
          "⚠️ Your Colly subscription payment failed. Please update your card to avoid losing access.",
        );

        await sendAlert(
          `Subscription payment FAILED for business ${businessId} (${data.plan?.name ?? "unknown plan"}). Taken over by human attention.`,
          "critical",
        );
        break;
      }

      // A successful recurring charge clears the dunning state, extends the plan
      // for another interval and RESETS the monthly credit allowance to the
      // plan's grant (Split Wallet: `planCredits` is overwritten, never
      // incremented, so unspent allowance does not roll over). Paid top-ups in
      // `topUpCredits` are deliberately left untouched.
      case "invoice.payment_success": {
        const businessId = await findBusinessId(data);
        if (!businessId) break;

        const business = await prisma.business.findUniqueOrThrow({
          where: { id: businessId },
          select: { planInterval: true, plan: true },
        });

        const interval = business.planInterval === "yearly" ? "yearly" : "monthly";
        const monthlyCredits = getMonthlyCredits(business.plan);
        await prisma.business.update({
          where: { id: businessId },
          data: {
            planStatus: "active",
            subscriptionStatus: "active",
            paymentFailedAt: null,
            gracePeriodEndsAt: null,
            planExpiresAt: addDays(
              new Date(),
              interval === "yearly" ? 365 : 30,
            ),
            ...(monthlyCredits > 0 ? { planCredits: monthlyCredits } : {}),
          },
        });
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    // Webhooks must always be acknowledged or Paystack retries forever.
    console.error("[POST /api/billing/webhook]", error);
    return Response.json({ received: true });
  }
}