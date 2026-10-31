import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/auth";
import { disableSubscription } from "@/lib/paystack";

// POST /api/billing/cancel
// Cancels a Paystack subscription. The business keeps its plan until the paid
// period ends (planExpiresAt), then billing stops.
//
// Owner-only (Team Collaboration): inviting staff must never hand them the
// ability to cancel the subscription, so a STAFF session gets 403 here.
export async function POST() {
  try {
    const auth = await requireOwnerApi();

    if (!auth.ok) {
      return auth.response;
    }

    const businessId = auth.user.businessId;

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        paystackSubscriptionCode: true,
        paystackEmailToken: true,
        planExpiresAt: true,
      },
    });

    if (
      !business.paystackSubscriptionCode ||
      !business.paystackEmailToken
    ) {
      return Response.json(
        {
          error: "No active Paystack subscription linked to this business",
        },
        { status: 400 },
      );
    }

    await disableSubscription({
      subscriptionCode: business.paystackSubscriptionCode,
      emailToken: business.paystackEmailToken,
    });

    await prisma.business.update({
      where: { id: businessId },
      data: { planStatus: "cancelled" },
    });

    return Response.json({
      ok: true,
      expiresAt: business.planExpiresAt,
    });
  } catch (error) {
    console.error("[POST /api/billing/cancel]", error);
    return Response.json(
      {
        error: "Failed to cancel subscription",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}