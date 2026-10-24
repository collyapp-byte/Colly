import { prisma } from "@/lib/prisma";
import { sendAlert } from "@/lib/alerts";
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
  invoice?: { paid?: boolean; transaction?: { reference?: string } } | null;
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
    console.log(`[billing] webhook: ${event.event}`);
    const data = event.data;

    switch (event.event) {
      case "charge.success": {
        const reference =
          data.reference ?? data.transaction?.reference ?? "";
        if (!reference) break;

        const transaction = await prisma.transaction.findUnique({
          where: { reference },
        });

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

        // Credit top-ups also fund the Naira wallet. The Transaction row's own
        // `type` is authoritative; metadata.type is the Paystack echo.
        const isCredit =
          transaction?.type === "credits" || data.metadata?.type === "credits";

        if (isCredit && transaction) {
          await prisma.business.update({
            where: { id: transaction.businessId },
            data: {
              creditWalletBalanceNaira: {
                increment: Number(transaction.amount),
              },
            },
          });
        }

        // A successful subscription charge pays off any past-due balance: clear
        // the dunning state so the AI keeps replying. Scoped by the resolved
        // business (from the transaction row, else the customer/subscription).
        const isSubscription =
          transaction?.type === "subscription" ||
          data.metadata?.type === "subscription" ||
          Boolean(data.subscription_code);

        if (isSubscription) {
          const businessId =
            transaction?.businessId ?? (await findBusinessId(data));
          if (businessId) {
            await prisma.business.update({
              where: { id: businessId },
              data: {
            subscriptionStatus: "active",
            planStatus: "active",
            paymentFailedAt: null,
            gracePeriodEndsAt: null,
          },
            });

            // Pay the referring agent 15% for up to 12 months from signup.
            const business = await prisma.business.findUnique({
              where: { id: businessId },
              select: {
                referredByAgentId: true,
                commissionEndsAt: true,
              },
            });

            if (
              business?.referredByAgentId &&
              business.commissionEndsAt &&
              new Date() < business.commissionEndsAt
            ) {
              const chargedAmountNaira = transaction?.amount
                ? Number(transaction.amount)
                : 0;
              if (chargedAmountNaira > 0) {
                const commissionNaira = Math.floor(chargedAmountNaira * 0.15);
                if (commissionNaira > 0) {
                  await prisma.agent.update({
                    where: { id: business.referredByAgentId },
                    data: {
                      commissionBalanceNaira: {
                        increment: commissionNaira,
                      },
                    },
                  });
                }
              }
            }
          }
        }
        break;
      }

      // Paystack fires `invoice.update` as a subscription invoice changes state
      // (including when a recurring charge fails). This is the canonical dunning
      // trigger: mark the business past_due, start a 3-day grace period and alert
      // the owner.
      case "invoice.update": {
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

      // A successful recurring charge clears the dunning state and extends the
      // plan for another interval.
      case "invoice.payment_success": {
        const businessId = await findBusinessId(data);
        if (!businessId) break;

        const business = await prisma.business.findUniqueOrThrow({
          where: { id: businessId },
          select: { planInterval: true, plan: true },
        });

        const interval = business.planInterval === "yearly" ? "yearly" : "monthly";
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