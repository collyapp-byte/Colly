// Colly's billing plans: the single source of truth for limits and prices.
//
// Credit Economy: 1 credit = ₦1. Plans grant credits every billing month and
// every AI reply spends credits out of that balance. Human (manual) replies are
// free. The price of an AI reply depends on the channel: WhatsApp carries
// Meta's per-message fee, while Telegram, Discord and Web Chat are cheap to
// serve.
//
// Every paid tier splits its monthly grant into `baseCredits` (what the price
// pays for) and `bonusCredits` (a marketing giveaway funded by Meta's 1,000
// free WhatsApp messages per month). The balance a business receives is always
// the total, `baseCredits + bonusCredits`.

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

/**
 * Shown right under a plan's monthly credit allowance: a subscription buys an
 * allowance that resets every renewal, while top-up credits were paid for and
 * stay on the balance forever.
 */
export const CREDITS_RESET_DISCLAIMER =
  "(Credits reset on renewal. Top-up credits never expire).";

/** Owner alert sent when the AI cannot afford a reply. */
export const LOW_CREDIT_MESSAGE =
  "Your credit balance is low. Please top up to continue replying.";

export type PlanConfig = {
  /** Naira Paystack charges per billing interval. */
  monthly: number;
  yearly: number;
  /** Credits the price pays for (1 credit = ₦1). */
  baseCredits: number;
  /**
   * Bonus credits given away on top of the base grant. They are funded by
   * Meta's 1,000 free WhatsApp messages per month, so they cost us nothing.
   */
  bonusCredits: number;
  /** Total credits granted per billing month: `baseCredits + bonusCredits`. */
  credits: number;
  /** Bonus headline: "Includes 200 Free WhatsApp Messages!". */
  bonusDescription: string;
  /** One-line pitch shown on the plans page. */
  description: string;
};

/** How many free WhatsApp AI replies a bonus grant buys (40 credits each). */
export function bonusWhatsappReplies(bonusCredits: number): number {
  return Math.floor(bonusCredits / REPLY_CREDIT_COSTS.whatsapp);
}

/**
 * The conversion badge under a plan's credits:
 * "+ 8,000 Bonus Credits = 200 FREE WhatsApp Messages".
 */
export function bonusCreditsBadge(bonusCredits: number): string {
  return `+ ${bonusCredits.toLocaleString()} Bonus Credits = ${bonusWhatsappReplies(
    bonusCredits,
  ).toLocaleString()} FREE WhatsApp Messages`;
}

/**
 * Builds one plan row. `credits` and `bonusDescription` are derived from the
 * base and bonus grants so a tier can never advertise a total it does not
 * actually pay out.
 */
function definePlan(config: {
  monthly: number;
  yearly: number;
  baseCredits: number;
  bonusCredits: number;
  description: string;
}): PlanConfig {
  return {
    ...config,
    credits: config.baseCredits + config.bonusCredits,
    bonusDescription: `Includes ${bonusWhatsappReplies(
      config.bonusCredits,
    ).toLocaleString()} Free WhatsApp Messages!`,
  };
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  // 15,000 base + 8,000 bonus = 23,000 credits (200 free WhatsApp replies).
  green: definePlan({
    monthly: 15_000,
    yearly: 150_000,
    baseCredits: 15_000,
    bonusCredits: 8_000,
    description: "For small boutiques and vendors getting started.",
  }),
  // 28,000 base + 16,000 bonus = 44,000 credits (400 free WhatsApp replies).
  blue: definePlan({
    monthly: 25_000,
    yearly: 250_000,
    baseCredits: 28_000,
    bonusCredits: 16_000,
    description: "For growing shops replying to customers all day.",
  }),
  // 60,000 base + 40,000 bonus = 100,000 credits (1,000 free WhatsApp replies).
  black: definePlan({
    monthly: 50_000,
    yearly: 500_000,
    baseCredits: 60_000,
    bonusCredits: 40_000,
    description: "For high-volume wholesalers and teams.",
  }),
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

/**
 * Naira charged for one credit. Top-ups are sold at face value — 1 credit =
 * ₦1 — so a 3,000-credit pack always costs ₦3,000, never ₦5,250. The rate lives
 * here so the checkout, the credit grant and the UI read the same number.
 */
export const NAIRA_PER_CREDIT = 1;

/** Naira a credit amount costs (and is worth) at the 1:1 top-up rate. */
export function creditsToNaira(credits: number): number {
  return credits * NAIRA_PER_CREDIT;
}

export type CreditPackageId = "free_credits" | "paid_credits";

/**
 * A top-up pack. `price` is derived from `credits` at the 1:1 rate, so the
 * advertised price and the amount Paystack charges can never drift apart.
 */
export type CreditPackage = {
  id: CreditPackageId;
  credits: number;
  price: number;
  currency: "NGN";
  label: string;
};

function defineCreditPackage(
  id: CreditPackageId,
  credits: number,
): CreditPackage {
  return {
    id,
    credits,
    price: creditsToNaira(credits),
    currency: "NGN",
    label: `${credits.toLocaleString("en-NG")} credits`,
  };
}

/**
 * Credit top-ups: never expire, used once the monthly allowance runs out.
 * Both packs are 3,000 credits for ₦3,000 now that top-ups are sold at face
 * value; the two ids are kept because the plan state still decides which one a
 * business is offered.
 */
export const CREDIT_PACKAGES: Record<CreditPackageId, CreditPackage> = {
  free_credits: defineCreditPackage("free_credits", 3_000),
  paid_credits: defineCreditPackage("paid_credits", 3_000),
};

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
 * Credits a plan pays out on activation and on every successful renewal — the
 * tier's total grant, `baseCredits + bonusCredits` (so Green pays 23,000, not
 * 15,000). Unknown plans grant nothing rather than throwing.
 */
export function getMonthlyCredits(plan?: string | null): number {
  if (plan === "trial") return TRIAL_CONFIG.credits;
  if (plan === "free") return FREE_PLAN_LIMITS.credits;
  return PLANS[plan as PlanTier]?.credits ?? 0;
}

/**
 * "23,000 Credits = 4,600 Telegram replies OR 575 WhatsApp replies" — the
 * calculator line shown under a plan's (total) credits.
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
