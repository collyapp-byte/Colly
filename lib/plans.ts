// Colly's billing plans: the single source of truth for limits and prices.
//
// Credit Economy: 1 credit = ₦1. Plans grant credits every billing month and
// every AI reply spends credits out of that balance. Human (manual) replies are
// free. The price of an AI reply depends on the channel: WhatsApp carries
// Meta's per-message fee, while Telegram, Discord and Web Chat are cheap to
// serve.

export type PlanTier = "green" | "blue" | "black";

export type PlanInterval = "monthly" | "yearly";

/** Whether a reply was written by the AI or by a human agent. */
export type CreditType = "ai" | "manual";

/**
 * Credits spent per reply. `standard` covers Telegram, Discord and Web Chat;
 * `whatsapp` is priced higher to cover Meta's per-conversation fee. Manual
 * replies never spend credits.
 */
export const REPLY_CREDIT_COSTS = {
  standard: 5,
  whatsapp: 40,
  manual: 0,
} as const;

/** Explains the credit economy under plan prices and on the credits page. */
export const CREDIT_ECONOMY_DESCRIPTION =
  "1 Credit = 1 Naira. Telegram/Discord AI replies cost 5 credits. WhatsApp replies cost 40 credits.";

/** Owner alert sent when the AI cannot afford a reply. */
export const LOW_CREDIT_MESSAGE =
  "Your credit balance is low. Please top up to continue replying.";

export type PlanConfig = {
  /** Naira Paystack charges per billing interval. */
  monthly: number;
  yearly: number;
  /** Credits granted per billing month (1 credit = ₦1). */
  credits: number;
  /** One-line pitch shown on the plans page. */
  description: string;
};

export const PLANS: Record<PlanTier, PlanConfig> = {
  green: {
    monthly: 15_000,
    yearly: 150_000,
    credits: 15_000,
    description: "For small boutiques and vendors getting started.",
  },
  blue: {
    monthly: 25_000,
    yearly: 250_000,
    credits: 28_000,
    description: "For growing shops replying to customers all day.",
  },
  black: {
    monthly: 50_000,
    yearly: 500_000,
    credits: 60_000,
    description: "For high-volume wholesalers and teams.",
  },
};


/**
 * Free trial: a time box plus a one-off credit grant, no card required. 250
 * credits is 50 Telegram replies (or 6 WhatsApp replies).
 */
export const TRIAL_CONFIG = {
  credits: 250,
  durationDays: 7,
  whatsappNumbersLimit: 1,
  seatsLimit: 1,
  productsLimit: 50,
  faqsLimit: 20,
};

/** The free plan grants no credits; AI replies must be topped up. */
export const FREE_PLAN_LIMITS = {
  monthly: 0,
  yearly: 0,
  credits: 0, // 0 AI credits
};

/** Credit top-ups: never expire, used once the balance runs out. */
export const CREDIT_PACKAGES = {
  free_credits: {
    id: "free_credits",
    credits: 3_000,
    price: 5_250,
    currency: "NGN",
    label: "3,000 credits",
  },
  paid_credits: {
    id: "paid_credits",
    credits: 3_000,
    price: 3_000,
    currency: "NGN",
    label: "3,000 credits",
  },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;
export type CreditPackage = (typeof CREDIT_PACKAGES)[CreditPackageId];

/** True when `value` is a plan tier name in the unified plan set. */
export function isPlanTierName(value: unknown): value is PlanTier {
  return typeof value === "string" && value in PLANS;
}

/** True when the business is on an active paid plan. */
export function isActivePaidPlan(business: {
  plan?: string | null;
  planStatus?: string | null;
}): boolean {
  if (business.planStatus !== "active") return false;
  return Boolean(PLANS[business.plan as PlanTier]);
}

/** Credits one AI reply costs on a channel (40 on WhatsApp, 5 everywhere else). */
export function getAiReplyCreditCost(channel?: string | null): number {
  return channel?.toUpperCase() === "WHATSAPP"
    ? REPLY_CREDIT_COSTS.whatsapp
    : REPLY_CREDIT_COSTS.standard;
}

/**
 * The credits debited for one reply. AI replies are priced by channel; human
 * (agent) replies are always free.
 */
export function getCreditPrice(
  business: { plan?: string | null; channel?: string | null },
  type: CreditType = "ai",
): number {
  if (type === "manual") return REPLY_CREDIT_COSTS.manual;
  return getAiReplyCreditCost(business.channel);
}

/**
 * Credits a plan grants on activation and on every successful renewal.
 * Unknown plans grant nothing rather than throwing.
 */
export function getMonthlyCredits(plan?: string | null): number {
  if (plan === "trial") return TRIAL_CONFIG.credits;
  if (plan === "free") return FREE_PLAN_LIMITS.credits;
  return PLANS[plan as PlanTier]?.credits ?? 0;
}

/**
 * "15,000 Credits = 3,000 Telegram replies OR 375 WhatsApp replies" — the
 * calculator line shown under a plan's price.
 */
export function creditReplyCalculator(credits: number): string {
  const telegram = Math.floor(credits / REPLY_CREDIT_COSTS.standard);
  const whatsapp = Math.floor(credits / REPLY_CREDIT_COSTS.whatsapp);
  return `${credits.toLocaleString()} Credits = ${telegram.toLocaleString()} Telegram replies OR ${whatsapp.toLocaleString()} WhatsApp replies`;
}

/**
 * Returns the correct credit package for a business based on its plan state.
 */
export function getCreditPackage(business: {
  plan?: string | null;
  planStatus?: string | null;
}): CreditPackage {
  return isActivePaidPlan(business)
    ? CREDIT_PACKAGES.paid_credits
    : CREDIT_PACKAGES.free_credits;
}

/**
 * The limits that apply to a business given its stored plan. The trial is its
 * own config, the free plan grants no credits, and a paid tier resolves against
 * the unified plan table. Unknown plans degrade to the trial limits rather
 * than throwing.
 *
 * `planInterval` ("monthly" | "yearly") does not change the limits — both
 * billing intervals share a tier's numbers — but it is kept in the signature
 * so callers pass through the stored interval without a separate lookup.
 */
export function getPlanLimits(plan: string, planInterval: string) {
  // Both billing intervals share the same limits; the interval only changes
  // what Paystack charges, and is kept so callers surface the right price.
  void planInterval;

  if (plan === "trial") {
    return TRIAL_CONFIG;
  }

  if (plan === "free") {
    return FREE_PLAN_LIMITS;
  }

  return PLANS[plan as PlanTier] ?? TRIAL_CONFIG;
}

/**
 * The Naira price of a plan tier for one billing interval.
 * Unknown tiers cost 0 rather than throwing.
 */
export function getPlanPrice(
  plan: string,
  interval: PlanInterval | string,
): number {
  const config = PLANS[plan as PlanTier];
  if (!config) return 0;
  return interval === "yearly" ? config.yearly : config.monthly;
}
