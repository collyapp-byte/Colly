import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/paystack";
import {
  PLANS,
  getPaystackPlanCode,
  type PlanInterval,
  type PlanTier,
} from "@/lib/plans";

const TIERS = ["starter", "business", "pro"] as const;

function isPlanTier(value: unknown): value is PlanTier {
  return (
    typeof value === "string" && (TIERS as readonly string[]).includes(value)
  );
}

const INTERVALS = ["monthly", "yearly"] as const;

function isPlanInterval(value: unknown): value is PlanInterval {
  return (
    typeof value === "string" && (INTERVALS as readonly string[]).includes(value)
  );
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// POST /api/billing/checkout
// Starts a Paystack subscription checkout for a paid plan. Returns the
// authorization URL the owner is redirected to; a pending Transaction row is
// created so the result can be reconciled by /api/billing/verify.
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request
      .json()
      .catch(() => null)) as {
      tier?: unknown;
      interval?: unknown;
    } | null;

    if (!body || !isPlanTier(body.tier) || !isPlanInterval(body.interval)) {
      return Response.json(
        { error: "tier (starter|business|pro) and interval (monthly|yearly) are required" },
        { status: 400 },
      );
    }

    const config = PLANS[body.tier];
    const amountKobo =
      body.interval === "monthly"
        ? config.monthlyPriceNaira * 100
        : config.yearlyPriceNaira * 100;
    const planCode = getPaystackPlanCode(body.tier, body.interval);

    if (!planCode) {
      return Response.json(
        {
          error: `No Paystack plan code configured for ${body.tier}/${body.interval}`,
        },
        { status: 400 },
      );
    }

    const callbackUrl = `${getAppUrl()}/billing/callback`;

    const payload = await initializeTransaction({
      email: user.email,
      amountKobo,
      planCode,
      callbackUrl,
      metadata: {
        businessId: user.businessId,
        tier: body.tier,
        interval: body.interval,
        type: "subscription",
      },
    });

    await prisma.transaction.create({
      data: {
        businessId: user.businessId,
        reference: payload.reference,
        amount: amountKobo / 100,
        status: "pending",
        type: "subscription",
        plan: body.tier,
        planInterval: body.interval,
      },
    });

    return Response.json({
      authorization_url: payload.authorization_url,
      reference: payload.reference,
    });
  } catch (error) {
    console.error("[POST /api/billing/checkout]", error);
    return Response.json(
      {
        error: "Failed to start checkout",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}