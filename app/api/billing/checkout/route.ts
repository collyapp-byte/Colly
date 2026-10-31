import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/auth";
import { initializeTransactionRaw } from "@/lib/paystack";
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

// POST /api/billing/checkout
// Starts a Paystack subscription checkout for a paid plan. Returns the
// authorization URL the owner is redirected to; a pending Transaction row is
// created so the result can be reconciled by /api/billing/verify.
//
// Owner-only (Team Collaboration): a subscription spends the business's money,
// so an invited STAFF session gets the 403 from `requireOwnerApi()`. The proxy
// skips `/api`, which makes this guard the real gate.
export async function POST(request: Request) {
  try {
    const auth = await requireOwnerApi();

    if (!auth.ok) {
      return auth.response;
    }

    const user = auth.user;

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
    const paystackPlanCode = getPaystackPlanCode(body.tier, body.interval);

    const payload: Record<string, string> = {
      email: user.email,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/callback`,
      plan: paystackPlanCode,
    };

    // Intentionally not logged: the payload carries the customer's email
    // address. The Paystack webhook and the verify route both record the
    // outcome against the Transaction row.

    let initialized;
    try {
      initialized = await initializeTransactionRaw(payload);
    } catch (error) {
      console.error("PAYSTACK INIT ERROR:", error);
      throw error;
    }

    await prisma.transaction.create({
      data: {
        businessId: user.businessId,
        reference: initialized.reference,
        amount: amountKobo / 100,
        status: "pending",
        type: "subscription",
        plan: body.tier,
        planInterval: body.interval,
      },
    });

    return Response.json({
      authorization_url: initialized.authorization_url,
      reference: initialized.reference,
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