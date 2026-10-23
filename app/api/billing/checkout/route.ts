import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/paystack";
import {
  getPlanPrice,
  isPlanTierName,
  type PlanInterval,
  type PlanTier,
} from "@/lib/plans";

const INTERVALS = ["monthly", "yearly"] as const;

function isPlanInterval(value: unknown): value is PlanInterval {
  return (
    typeof value === "string" && (INTERVALS as readonly string[]).includes(value)
  );
}

const PAYSTACK_PLAN_ENV: Record<PlanTier, Record<PlanInterval, string>> = {
  green: {
    monthly: "PAYSTACK_PLAN_GREEN_M",
    yearly: "PAYSTACK_PLAN_GREEN_Y",
  },
  blue: {
    monthly: "PAYSTACK_PLAN_BLUE_M",
    yearly: "PAYSTACK_PLAN_BLUE_Y",
  },
  black: {
    monthly: "PAYSTACK_PLAN_BLACK_M",
    yearly: "PAYSTACK_PLAN_BLACK_Y",
  },
};

function getPaystackPlanCode(plan: PlanTier, interval: PlanInterval): string {
  const planCode = process.env[PAYSTACK_PLAN_ENV[plan][interval]];

  if (!planCode) {
    throw new Error(`Paystack Plan Code missing for ${plan} ${interval}`);
  }

  return planCode;
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

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: user.businessId },
      select: { channel: true },
    });

    const body = (await request
      .json()
      .catch(() => null)) as {
      tier?: unknown;
      interval?: unknown;
    } | null;

    if (
      !body ||
      !isPlanTierName(body.tier) ||
      !isPlanInterval(body.interval)
    ) {
      return Response.json(
        {
          error:
            "tier (green|blue|black) and interval (monthly|yearly) are required",
        },
        { status: 400 },
      );
    }

    const amountKobo = getPlanPrice(body.tier, body.interval) * 100;
    const planCode = getPaystackPlanCode(body.tier, body.interval);

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
        channel: business.channel,
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
    const detail = error instanceof Error ? error.message : String(error);
    const isPlanCodeError = detail.startsWith("Paystack Plan Code missing");
    return Response.json(
      {
        error: isPlanCodeError ? detail : "Failed to start checkout",
        detail,
      },
      { status: 500 },
    );
  }
}