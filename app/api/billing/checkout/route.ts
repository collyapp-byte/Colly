import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/paystack";
import {
  TELEGRAM_PLANS,
  WHATSAPP_PLANS,
  getPaystackPlanCode,
  getPlanPrice,
  isChannel,
  isTelegramChannel,
  type PlanInterval,
  type PlanTier,
} from "@/lib/plans";

const WHATSAPP_TIERS = Object.keys(WHATSAPP_PLANS) as PlanTier[];
const TELEGRAM_TIERS = Object.keys(TELEGRAM_PLANS) as PlanTier[];

function isPlanTier(value: unknown, channel: string): value is PlanTier {
  const tiers = isTelegramChannel(channel) ? TELEGRAM_TIERS : WHATSAPP_TIERS;
  return typeof value === "string" && tiers.includes(value as PlanTier);
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

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: user.businessId },
      select: { channel: true },
    });

    const body = (await request
      .json()
      .catch(() => null)) as {
      tier?: unknown;
      interval?: unknown;
      channel?: unknown;
    } | null;

    // The plans page lets the owner pick a channel (Telegram is the default).
    // Fall back to the business's stored channel when none is supplied.
    const channel = isChannel(body?.channel) ? body.channel : business.channel;

    if (!body || !isPlanTier(body.tier, channel) || !isPlanInterval(body.interval)) {
      const tiers = isTelegramChannel(channel)
        ? "green|blue|black"
        : "starter|business|pro";
      return Response.json(
        { error: `tier (${tiers}) and interval (monthly|yearly) are required` },
        { status: 400 },
      );
    }

    const amountKobo = getPlanPrice(body.tier, body.interval, channel) * 100;
    const planCode = getPaystackPlanCode(body.tier, body.interval, channel);

    if (!planCode) {
      return Response.json(
        {
          error: `No Paystack plan code configured for ${channel} ${body.tier}/${body.interval}`,
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
        channel,
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