import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  fetchSubscription,
  verifyTransaction,
  type VerifyTransactionData,
} from "@/lib/paystack";
import { CREDIT_PACKAGES } from "@/lib/plans";

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
// On success the pending Transaction is marked paid and the business's plan or
// credit balance is applied. Idempotent: an already-finalized transaction is
// left alone.
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
    let creditsBalance = await getCreditsBalance(user.businessId);

    // Already fulfilled (e.g. the webhook beat this browser callback): the
    // payment is confirmed, so report success without re-applying anything.
    // Without this, the fall-through below would return ok:false and the client
    // would show a false "could not be confirmed" error.
    if (data.status === "success" && transaction.status === "success") {
      return Response.json({ ok: true, plan, creditsBalance });
    }

    if (data.status === "success" && transaction.status === "pending") {
      // Idempotency guard (BUG 2): atomically flip this transaction from
      // "pending" to "success". Only the first caller (verify or the webhook)
      // wins the claim; a repeat call sees 0 rows and no-ops without touching
      // creditsBalance or the plan.
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
        creditsBalance = await getCreditsBalance(user.businessId);
        return Response.json({ ok: true, plan, creditsBalance });
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

        return Response.json({ ok: true, plan, creditsBalance });
      }

      // Credits: add the purchased replies to the balance.
      const purchased =
        transaction.creditsPurchased ?? CREDIT_PACKAGES.free_credits.messages;
      await prisma.business.update({
        where: { id: user.businessId },
        data: {
          creditsBalance: { increment: purchased },
        },
      });

      creditsBalance = await getCreditsBalance(user.businessId);
      return Response.json({ ok: true, plan, creditsBalance });
    }

    // Not a successful, pending payment (already handled, abandoned, failed...).
    return Response.json({ ok: false, plan, creditsBalance });
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

async function getCreditsBalance(businessId: string): Promise<number> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { creditsBalance: true },
  });

  return business.creditsBalance;
}