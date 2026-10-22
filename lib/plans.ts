// Colly's billing plans: the single source of truth for limits and prices.
//
// Colly sells on two channels — WhatsApp and Telegram — each with its own
// tiers, monthly message allowances and per-reply credit prices. All tiers
// get every feature (Pidgin, voice notes, image recognition, negotiation);
// only the volume and capacity numbers differ. Prices are in Naira.
//
// Credits are a Naira wallet (`Business.creditWalletBalanceNaira`): money on
// account that pays for replies over the plan's monthly allowance at the
// channel's `aiCredit` / `manualCredit` rates.

export type Channel = "WHATSAPP" | "TELEGRAM";

export type WhatsappPlanTier = "starter" | "business" | "pro";
export type TelegramPlanTier = "green" | "blue" | "black";
export type PlanTier = WhatsappPlanTier | TelegramPlanTier;

export type PlanInterval = "monthly" | "yearly";

/** Whether a reply over the cap was written by the AI or by a human agent. */
export type CreditType = "ai" | "manual";

export type PlanConfig = {
  /** Naira Paystack charges per billing interval. */
  monthly: number;
  yearly: number;
  /** AI replies included per billing month before the wallet pays per reply. */
  includedMsgs: number;
  /** Manual (agent) replies included per billing month before the wallet pays. */
  includedManualMessages: number;
  /** Naira debited from the wallet per AI reply over the monthly cap. */
  aiCredit: number;
  /** Naira debited from the wallet per human (agent) reply over the cap. */
  manualCredit: number;
};

export const WHATSAPP_PLANS: Record<WhatsappPlanTier, PlanConfig> = {
  starter: {
    monthly: 15_000,
    yearly: 150_000,
    includedMsgs: 500,
    includedManualMessages: 500,
    aiCredit: 20,
    manualCredit: 15,
  },
  business: {
    monthly: 25_000,
    yearly: 250_000,
    includedMsgs: 1_500,
    includedManualMessages: 1_500,
    aiCredit: 20,
    manualCredit: 15,
  },
  pro: {
    monthly: 50_000,
    yearly: 500_000,
    includedMsgs: 2_500,
    includedManualMessages: 2_500,
    aiCredit: 20,
    manualCredit: 15,
  },
};

export const TELEGRAM_PLANS: Record<TelegramPlanTier, PlanConfig> = {
  green: {
    monthly: 15_000,
    yearly: 150_000,
    includedMsgs: 2_000,
    includedManualMessages: 2_000,
    aiCredit: 10,
    manualCredit: 0,
  },
  blue: {
    monthly: 25_000,
    yearly: 250_000,
    includedMsgs: 6_000,
    includedManualMessages: 6_000,
    aiCredit: 10,
    manualCredit: 0,
  },
  black: {
    monthly: 50_000,
    yearly: 500_000,
    includedMsgs: 999_999,
    includedManualMessages: 999_999,
    aiCredit: 10,
    manualCredit: 0,
  },
};

/** Free trial: a time box plus a one-off reply allowance, no card required. */
export const TRIAL_CONFIG = {
  includedMsgs: 50,
  includedManualMessages: 50,
  durationDays: 7,
  whatsappNumbersLimit: 1,
  seatsLimit: 1,
  productsLimit: 50,
  faqsLimit: 20,
};

/** The free plan has no monthly allowance; replies must come from the wallet. */
export const FREE_PLAN_LIMITS = {
  monthly: 0,
  yearly: 0,
  includedMsgs: 0, // 0 AI replies
  includedManualMessages: 50, // 50 manual replies
  aiCredit: 20,
  manualCredit: 15,
};

/** Credit packages: never expire, used after monthly plan allowance runs out. */
export const CREDIT_PACKAGES = {
  free_credits: {
    id: "free_credits",
    messages: 150,
    price: 5_250,
    currency: "NGN",
    label: "150 messages",
    perMessagePrice: 35,
  },
  paid_credits: {
    id: "paid_credits",
    messages: 150,
    price: 3_000,
    currency: "NGN",
    label: "150 messages",
    perMessagePrice: 20,
  },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;
export type CreditPackage = (typeof CREDIT_PACKAGES)[CreditPackageId];

/** A stored `Business.channel` that is not "TELEGRAM" means WhatsApp. */
export function isTelegramChannel(channel: string | null | undefined): boolean {
  return channel === "TELEGRAM";
}

/** True when the value is one of the two supported channels. */
export function isChannel(value: unknown): value is Channel {
  return value === "WHATSAPP" || value === "TELEGRAM";
}

/**
 * The channel a plan tier belongs to. Tier names are disjoint across channels
 * (green/blue/black vs starter/business/pro), so a plan alone identifies its
 * channel — used when activating a subscription that did not store a channel.
 */
export function channelForTier(tier: string | null | undefined): Channel {
  return tier && tier in TELEGRAM_PLANS ? "TELEGRAM" : "WHATSAPP";
}

/**
 * True when `value` is a plan tier name on any channel ("green" | "blue" |
 * "black" | "starter" | "business" | "pro"). Used to validate the tier that
 * comes in on a URL (e.g. /signup?plan=green).
 */
export function isPlanTierName(value: unknown): value is PlanTier {
  return (
    typeof value === "string" &&
    (value in TELEGRAM_PLANS || value in WHATSAPP_PLANS)
  );
}

/**
 * True when `tier` is a plan tier of `channel`'s plan table. Tier names are
 * disjoint across channels, so a Telegram tier is never a WhatsApp tier.
 */
export function isTierForChannel(tier: string, channel: Channel): boolean {
  return channel === "TELEGRAM" ? tier in TELEGRAM_PLANS : tier in WHATSAPP_PLANS;
}

/** The plan table for a business's channel; anything but Telegram is WhatsApp. */
function plansFor(channel: string | null | undefined): Record<string, PlanConfig> {
  return isTelegramChannel(channel) ? TELEGRAM_PLANS : WHATSAPP_PLANS;
}

/** True when the business is on an active paid plan for its channel. */
export function isActivePaidPlan(business: {
  plan?: string | null;
  planStatus?: string | null;
  channel?: string | null;
}): boolean {
  if (business.planStatus !== "active") return false;
  return Boolean(plansFor(business.channel)[business.plan ?? ""]);
}

/**
 * The Naira debited from the wallet for one reply over the monthly cap.
 * AI replies cost `aiCredit`, human (agent) replies `manualCredit`. The rates
 * live on the channel's plan tiers; every tier on a channel currently shares
 * the same rates, so free/expired businesses fall back to the entry tier.
 */
export function getCreditPrice(
  business: { channel?: string | null; plan?: string | null },
  type: CreditType = "ai",
): number {
  const plans = plansFor(business.channel);
  const config = plans[business.plan ?? ""] ?? plans[Object.keys(plans)[0]];
  return type === "manual" ? config.manualCredit : config.aiCredit;
}

/**
 * Returns the correct credit package for a business based on its plan state.
 */
export function getCreditPackage(business: {
  plan?: string | null;
  planStatus?: string | null;
  channel?: string | null;
}): CreditPackage {
  return isActivePaidPlan(business)
    ? CREDIT_PACKAGES.paid_credits
    : CREDIT_PACKAGES.free_credits;
}

/**
 * The limits that apply to a business given its stored plan and channel. The
 * trial is its own config, the free plan has no allowance, and a paid tier
 * resolves against the plan table of the business's channel. Unknown plans
 * degrade to the trial limits rather than throwing.
 *
 * `planInterval` ("monthly" | "yearly") does not change the limits — both
 * billing intervals share a tier's numbers — but it is kept in the signature
 * so callers pass through the stored interval without a separate lookup.
 */
export function getPlanLimits(plan: string, planInterval: string, channel?: string | null) {
  // Both billing intervals share the same limits; the interval only changes
  // what Paystack charges, and is kept so callers surface the right price.
  void planInterval;

  if (plan === "trial") {
    return TRIAL_CONFIG;
  }

  if (plan === "free") {
    return FREE_PLAN_LIMITS;
  }

  return plansFor(channel)[plan] ?? TRIAL_CONFIG;
}

/**
 * The Naira price of a plan tier for one billing interval on a channel.
 * Unknown tiers cost 0 rather than throwing.
 */
export function getPlanPrice(
  plan: string,
  interval: PlanInterval | string,
  channel?: string | null,
): number {
  const config = plansFor(channel)[plan];
  if (!config) return 0;
  return interval === "yearly" ? config.yearly : config.monthly;
}

/**
 * The Paystack plan code for a channel + tier + billing interval, configured
 * via env vars like `PAYSTACK_PLAN_WA_STARTER_M` or `PAYSTACK_PLAN_TG_GREEN_Y`.
 * Returns null when the code has not been set up yet.
 */
export function getPaystackPlanCode(
  tier: string,
  interval: PlanInterval | string,
  channel?: string | null,
): string | null {
  const channelCode = isTelegramChannel(channel) ? "TG" : "WA";
  const intervalCode = interval === "yearly" ? "Y" : "M";
  const envKey = `PAYSTACK_PLAN_${channelCode}_${tier.toUpperCase()}_${intervalCode}`;
  return process.env[envKey] ?? null;
}
