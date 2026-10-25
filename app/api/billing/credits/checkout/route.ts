import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/paystack";
import { creditsToNaira, getCreditPackage } from "@/lib/plans";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// POST /api/billing/credits/checkout
// Starts a Paystack checkout for a one-off credit top-up. Every pack is sold at
// face value — 1 credit = ₦1 — so the charge is simply the credit amount
// multiplied by 1 (3,000 credits = ₦3,000, with no markup). Unlike a
// subscription checkout there is no plan code: the payment is a single charge
// and the credits are added to the balance by /api/billing/verify.
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

    // 1 credit = ₦1: the Naira amount is the credit amount times 1.
    const amountNaira = creditsToNaira(creditPackage.credits);

    const callbackUrl = `${getAppUrl()}/billing/callback`;

    const payload = await initializeTransaction({
      email: user.email,
      amountKobo: amountNaira * 100,
      callbackUrl,
      metadata: {
        businessId: user.businessId,
        type: "credits",
        creditsIncluded: creditPackage.credits,
      },
    });

    await prisma.transaction.create({
      data: {
        businessId: user.businessId,
        reference: payload.reference,
        amount: amountNaira,
        status: "pending",
        type: "credits",
        creditsPurchased: creditPackage.credits,
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