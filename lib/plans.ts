// Colly's billing plans: the single source of truth for limits and prices.
//
// All tiers get every feature (Pidgin, voice notes, image recognition,
// negotiation); only the volume and capacity numbers differ. Prices are in
// Naira. `-1` in a limit means "unlimited".

export type PlanTier = "free" | "starter" | "business" | "pro";

export type PlanInterval = "monthly" | "yearly";

export type PlanConfig = {
  tier: PlanTier;
  monthlyPriceNaira: number;
  yearlyPriceNaira: number;
  includedMessages: number;
  overCapCreditPrice: number;
  whatsappNumbersLimit: number; // -1 = unlimited
  seatsLimit: number; // -1 = unlimited
  productsLimit: number; // -1 = unlimited
  faqsLimit: number; // -1 = unlimited
  hasAnalytics: boolean;
  hasPrioritySupport: boolean;
  hasCustomNegotiation: boolean;
};

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    monthlyPriceNaira: 0,
    yearlyPriceNaira: 0,
    includedMessages: 0,
    overCapCreditPrice: 35,
    whatsappNumbersLimit: 1,
    seatsLimit: 1,
    productsLimit: 50,
    faqsLimit: 20,
    hasAnalytics: false,
    hasPrioritySupport: false,
    hasCustomNegotiation: false,
  },
  starter: {
    tier: "starter",
    monthlyPriceNaira: 15_000,
    yearlyPriceNaira: 150_000,
    includedMessages: 500,
    overCapCreditPrice: 20,
    whatsappNumbersLimit: 1,
    seatsLimit: 1,
    productsLimit: 100,
    faqsLimit: 50,
    hasAnalytics: false,
    hasPrioritySupport: false,
    hasCustomNegotiation: false,
  },
  business: {
    tier: "business",
    monthlyPriceNaira: 25_000,
    yearlyPriceNaira: 250_000,
    includedMessages: 1_500,
    overCapCreditPrice: 20,
    whatsappNumbersLimit: 2,
    seatsLimit: 3,
    productsLimit: 500,
    faqsLimit: 200,
    hasAnalytics: true,
    hasPrioritySupport: false,
    hasCustomNegotiation: false,
  },
  pro: {
    tier: "pro",
    monthlyPriceNaira: 50_000,
    yearlyPriceNaira: 500_000,
    includedMessages: 2_500,
    overCapCreditPrice: 20,
    whatsappNumbersLimit: 5,
    seatsLimit: -1,
    productsLimit: -1,
    faqsLimit: -1,
    hasAnalytics: true,
    hasPrioritySupport: true,
    hasCustomNegotiation: true,
  },
};

/** Free trial: a time box plus a one-off reply allowance, no card required. */
export const TRIAL_CONFIG = {
  aiRepliesLimit: 50,
  durationDays: 5,
  whatsappNumbersLimit: 1,
  seatsLimit: 1,
  productsLimit: 50,
  faqsLimit: 20,
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

/**
 * Returns the per-message credit price for a business based on its plan state.
 * Free/expired/trial plans: ₦35/msg. Active paid plans: ₦20/msg.
 */
export function getCreditPrice(business: {
  plan: string;
  planStatus: string;
  onboardingEndsAt: Date | null;
}): number {
  const isActivePaidPlan =
    business.planStatus === "active" &&
    ["starter", "business", "pro"].includes(business.plan);

  if (isActivePaidPlan) return 20;
  return 35;
}

/**
 * Returns the correct credit package for a business based on its plan state.
 */
export function getCreditPackage(business: {
  plan: string;
  planStatus: string;
  onboardingEndsAt: Date | null;
}): CreditPackage {
  const price = getCreditPrice(business);
  return price === 20 ? CREDIT_PACKAGES.paid_credits : CREDIT_PACKAGES.free_credits;
}

/**
 * The limits that apply to a business given its stored plan. The trial is
 * its own config; anything else resolves to the matching tier. Unknown plans
 * degrade to the trial limits rather than throwing.
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

  return PLANS[plan as PlanTier] ?? TRIAL_CONFIG;
}

/**
 * The Paystack plan code for a tier + billing interval, configured via env
 * vars like `PAYSTACK_PLAN_STARTER_MONTHLY`. Returns null when the code has
 * not been set up yet.
 */
export function getPaystackPlanCode(
  tier: PlanTier,
  interval: PlanInterval,
): string | null {
  const envKey = `PAYSTACK_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}`;
  return process.env[envKey] ?? null;
}