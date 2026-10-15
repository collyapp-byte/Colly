import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { disableSubscription } from "@/lib/paystack";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// POST /api/billing/cancel
// Cancels a Paystack subscription. The business keeps its plan until the paid
// period ends (planExpiresAt), then billing stops.
export async function POST() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

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