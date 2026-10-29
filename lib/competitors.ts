/**
 * The competitor-comparison data behind `/vs/[competitor]`.
 *
 * Two rules keep this file usable by a lawyer and by an AI answer engine:
 *
 * 1. Colly's own cells are facts, and every price is interpolated from
 *    `lib/plans.ts` — a comparison table that quotes a price the checkout does
 *    not charge is worse than no comparison table.
 * 2. A competitor's cell describes the category it publicly positions itself in,
 *    never an unverifiable scrape of their pricing page. Anything we cannot
 *    confirm is phrased as "advertised"/"varies by plan" rather than asserted,
 *    and `COMPETITOR_DISCLAIMER` is rendered next to the table.
 *
 * `app/(marketing)/vs/[competitor]/page.tsx` prerenders one page per entry and
 * `lib/seo.ts#comparisonJsonLd` turns the same rows into the ItemList an AI
 * Overview reads, so the table, the page copy and the schema cannot drift.
 *
 * Dependency-free apart from the pure `lib/plans.ts` / `lib/format.ts` modules:
 * `lib/site.ts` imports this file to build the sitemap.
 */

import { formatNaira } from "@/lib/format";
import { PLANS, REPLY_CREDIT_COSTS } from "@/lib/plans";

/** The axes a buyer (or an answer engine) actually compares. */
export type ComparisonFeatureId = "ai" | "pricing" | "jiji" | "channels" | "cac";

export type ComparisonFeature = {
  id: ComparisonFeatureId;
  /** Row label, written the way the question is asked. */
  label: string;
  /** What Colly AI does on this axis. */
  colly: string;
};

/**
 * One row per axis, in the order the table renders them. Colly's answers are
 * the differentiators, stated plainly: an AI engine quoting the row should be
 * able to lift the sentence as-is.
 */
export const COMPARISON_FEATURES: readonly ComparisonFeature[] = [
  {
    id: "ai",
    label: "Native AI vs human inbox",
    colly:
      "Native AI on every plan: it replies in seconds, quotes your catalogue, negotiates down to your floor price and hands the chat to you the moment a human is needed.",
  },
  {
    id: "pricing",
    label: "Naira credit economy vs USD subscription",
    colly: `Naira credit economy: 1 credit = ₦1, ${
      REPLY_CREDIT_COSTS.standard
    } credits per AI reply and plans from ${formatNaira(
      PLANS.green.monthly,
    )}/month, billed through Paystack. No USD card and no exchange-rate surprises.`,
  },
  {
    id: "jiji",
    label: "Jiji marketplace sync",
    colly:
      "Imports a Jiji shop from the seller URL or username, then re-syncs prices and stock whenever you run a sync.",
  },
  {
    id: "channels",
    label: "Telegram and Web Chat support",
    colly:
      "Telegram, Discord and Web Chat are self-serve and live in minutes, sharing one credit balance.",
  },
  {
    id: "cac",
    label: "Zero CAC requirement",
    colly:
      "No CAC certificate to start: Telegram, Discord and Web Chat need no Meta review. WhatsApp is the exception — Meta requires verification, so Colly onboards it from a manual waitlist.",
  },
];

export type Competitor = {
  /** URL segment and `[competitor]` param, e.g. `wati`. */
  slug: string;
  /** Display name, as the vendor writes it. */
  name: string;
  /** The category they publicly position themselves in, lowercase mid-sentence. */
  category: string;
  /** One neutral sentence describing the tool. */
  summary: string;
  /** Who the tool is genuinely a good fit for. Honest, not a straw man. */
  bestFor: string;
  /** Their billing model, at category level. */
  pricingModel: string;
  /** One cell per `COMPARISON_FEATURES` row. */
  values: Record<ComparisonFeatureId, string>;
  /** Why a Nigerian SME usually ends up on Colly instead. */
  collyEdge: string;
};

export const COMPETITORS: readonly Competitor[] = [
  {
    slug: "dmly",
    name: "DMLY",
    category: "a social DM automation tool for Instagram and Facebook inboxes",
    summary:
      "DMLY automates direct-message replies on Instagram and Facebook, aimed at shops whose enquiries arrive in those inboxes.",
    bestFor:
      "Businesses whose sales happen almost entirely inside Instagram and Facebook direct messages.",
    pricingModel: "A USD-denominated subscription, tiered by inbox volume.",
    values: {
      ai: "Template and automation flows in the social inbox; how much of a reply is generative AI varies by plan.",
      pricing:
        "Billed in USD, so the Naira cost moves with the exchange rate whenever you pay.",
      jiji: "No Jiji catalogue sync advertised.",
      channels:
        "Instagram and Facebook DMs by design; Telegram and an embeddable web widget are not advertised.",
      cac: "No CAC certificate to start, but a foreign card and USD billing usually are.",
    },
    collyEdge:
      "Colly answers in the channels Nigerian shops already run — Telegram, Discord and Web Chat — with catalogue prices, Pidgin and Naira billing.",
  },
  {
    slug: "revoplyai",
    name: "Revoply AI",
    category: "an AI reply assistant layered on top of an existing sales inbox",
    summary:
      "Revoply AI positions itself as an AI reply layer for inbound sales messages, so a team can answer faster without hiring.",
    bestFor:
      "Teams that already have a working inbox and want AI drafting on top of it.",
    pricingModel: "A USD-denominated subscription.",
    values: {
      ai: "AI-drafted replies over the inbox you already use: the assistant is a layer, not the whole workflow.",
      pricing:
        "USD subscription billing, so the Naira cost follows the exchange rate.",
      jiji: "No Jiji catalogue sync advertised.",
      channels:
        "Social and email inboxes; Telegram and web chat are not advertised as native channels.",
      cac: "Nothing Nigeria-specific advertised; a foreign card is typically required.",
    },
    collyEdge:
      "Colly is the whole workflow for a Nigerian shop — catalogue, negotiation floor, credits and Telegram/web chat — set up in one afternoon.",
  },
  {
    slug: "wati",
    name: "WATI",
    category: "a WhatsApp-first customer engagement platform",
    summary:
      "WATI is a WhatsApp-first engagement platform with team inboxes, template messages and automation flows.",
    bestFor:
      "Businesses that have already completed Meta business verification and want WhatsApp as their main channel.",
    pricingModel:
      "A USD subscription on top of Meta's WhatsApp conversation charges.",
    values: {
      ai: "Keyword and template automation, with AI features depending on the plan.",
      pricing:
        "USD subscription plus Meta's per-conversation WhatsApp charges.",
      jiji: "No Jiji catalogue sync advertised.",
      channels:
        "WhatsApp-first; Telegram and an embeddable web widget are not the product's focus.",
      cac: "Yes on WhatsApp: the official API needs a Meta business account and, in Nigeria, a CAC certificate and review.",
    },
    collyEdge:
      "Colly lets a shop start selling today with no CAC certificate and no Meta review, and adds WhatsApp only once the numbers justify the paperwork.",
  },
];

/** Rendered under the table: keeps the comparison honest and dated. */
export const COMPETITOR_REVIEWED = "October 2026";

export const COMPETITOR_DISCLAIMER = `Competitor details come from their public websites and were last reviewed in ${COMPETITOR_REVIEWED}. Check with the vendor before you buy, and note that Colly is not affiliated with any tool listed here.`;

/** Root-relative URL of a comparison page. */
export function competitorPath(slug: string): string {
  return `/vs/${slug}`;
}

/** The competitor behind a `[competitor]` segment, or `undefined`. */
export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((competitor) => competitor.slug === slug);
}

/**
 * The direct answer the page opens with and the schema publishes as its
 * description: a self-contained sentence pair an AI Overview can quote.
 */
export function comparisonAnswer(competitor: Competitor): string {
  return (
    `Colly AI is an AI sales assistant for Nigerian businesses, billed in Naira: plans start at ${formatNaira(
      PLANS.green.monthly,
    )} per month, AI replies cost ${
      REPLY_CREDIT_COSTS.standard
    } credits (1 credit = ₦1) and no CAC certificate is needed on Telegram, Discord or Web Chat. ${
      competitor.name
    } is ${competitor.category}.`
  );
}
