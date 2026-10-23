import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/paystack";
import { getCreditPackage } from "@/lib/plans";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// POST /api/billing/credits/checkout
// Starts a Paystack checkout for a one-off credit top-up. The package (and
// price) depends on the business's plan state: free/expired plans buy at ₦35
// per message (₦5,250 / 150 messages), active paid plans at ₦20 per message
// (₦3,000 / 150 messages). Unlike a subscription checkout there is no plan
// code: the payment is a single charge and the balance is credited by
// /api/billing/verify.
export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: user.businessId },
      select: { plan: true, planStatus: true },
    });

    const creditPackage = getCreditPackage({
      plan: business.plan,
      planStatus: business.planStatus,
    });

    const callbackUrl = `${getAppUrl()}/billing/callback`;

    const payload = await initializeTransaction({
      email: user.email,
      amountKobo: creditPackage.price * 100,
      callbackUrl,
      metadata: {
        businessId: user.businessId,
        type: "credits",
        creditsIncluded: creditPackage.messages,
      },
    });

    await prisma.transaction.create({
      data: {
        businessId: user.businessId,
        reference: payload.reference,
        amount: creditPackage.price,
        status: "pending",
        type: "credits",
        creditsPurchased: creditPackage.messages,
      },
    });

    return Response.json({
      authorization_url: payload.authorization_url,
      reference: payload.reference,
    });
  } catch (error) {
    console.error("[POST /api/billing/credits/checkout]", error);
    return Response.json(
      {
        error: "Failed to start credits checkout",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}