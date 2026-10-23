// Colly's billing plans: the single source of truth for limits and prices.
//
// One unified plan model applies across all connected channels (Telegram,
// Discord, Web Chat). Message limits are shared globally.

export type PlanTier = "green" | "blue" | "black";

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

export const PLANS: Record<PlanTier, PlanConfig> = {
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
    includedMsgs: 30_000,
    includedManualMessages: 30_000,
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

/**
 * The Naira debited from the wallet for one reply over the monthly cap.
 * AI replies cost `aiCredit`, human (agent) replies `manualCredit`. Free or
 * expired businesses fall back to the entry tier's rates.
 */
export function getCreditPrice(
  business: { plan?: string | null },
  type: CreditType = "ai",
): number {
  const config = PLANS[business.plan as PlanTier] ?? PLANS.green;
  return type === "manual" ? config.manualCredit : config.aiCredit;
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
 * own config, the free plan has no allowance, and a paid tier resolves against
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
