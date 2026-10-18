import { prisma } from "@/lib/prisma";
import { sendAlert } from "@/lib/alerts";
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
  transaction?: {
    channel?: string;
    paid_at?: string;
    status?: string;
    reference?: string;
  } | null;
  invoice?: { paid?: boolean; transaction?: { reference?: string } } | null;
};

type WebhookEvent = { event: string; data: WebhookEventData };

/**
 * Maps a webhook event back to a Business. The subscriber's Paystack customer
 * code is the most reliable link; the owner email (from the User table) and
 * then the stored billing email cover the first payment, before the customer
 * code is saved.
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
          data: { planStatus: "cancelled" },
        });
        break;
      }

      case "invoice.payment_failed": {
        const businessId = await findBusinessId(data);
        if (!businessId) break;

        await prisma.business.update({
          where: { id: businessId },
          data: { planStatus: "past_due" },
        });

        await sendAlert(
          `Subscription payment FAILED for business ${businessId} (${data.plan?.name ?? "unknown plan"}). Taken over by human attention.`,
          "critical",
        );
        break;
      }

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