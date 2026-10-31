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

/**
 * The axes a buyer (or an answer engine) actually compares. Declared in table
 * order: the three advantages Colly leads on — no CAC paperwork, Naira credits,
 * Pidgin and voice notes — come first, because they are the reasons a Nigerian
 * shop switches, then the channel list and the AI-depth row.
 *
 * A new id is a breaking change on purpose: `Competitor.values` is keyed by this
 * union, so TypeScript refuses the build until every vendor answers the new row.
 */
export type ComparisonFeatureId =
  | "cac"
  | "pricing"
  | "pidgin"
  | "channels"
  | "ai";

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
    id: "cac",
    label: "Zero CAC requirement",
    colly:
      "No CAC certificate to start: Telegram, Discord and Web Chat need no Meta review. WhatsApp is the exception — Meta requires verification, so Colly onboards it from a manual waitlist.",
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
    id: "pidgin",
    label: "Pidgin and voice-note support",
    colly:
      "Replies in English or Nigerian Pidgin — the tone is a setting — and an inbound voice note is transcribed before the assistant answers it from your catalogue.",
  },
  {
    id: "channels",
    label: "Telegram and Web Chat support",
    colly:
      "Telegram, Discord and Web Chat are self-serve and live in minutes, sharing one credit balance.",
  },
  {
    id: "ai",
    label: "Native AI vs human inbox",
    colly:
      "Native AI on every plan: it replies in seconds, quotes your catalogue, negotiates down to your floor price and hands the chat to you the moment a human is needed.",
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
  /**
   * The competitor's feature answers — the per-vendor "features" list: one cell
   * per `COMPARISON_FEATURES` row, keyed by axis id. The comparison table renders
   * it, `lib/seo.ts#comparisonJsonLd` publishes it as `additionalProperty`, and
   * because the record is keyed by `ComparisonFeatureId`, a vendor cannot ship
   * with a row missing or silently skip a newly added axis.
   */
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
      cac: "No CAC certificate to start, but a foreign card and USD billing usually are.",
      pricing:
        "Billed in USD, so the Naira cost moves with the exchange rate whenever you pay.",
      pidgin:
        "Replies are scripted inside the social inbox; Pidgin tone and voice-note handling are not advertised.",
      channels:
        "Instagram and Facebook DMs by design; Telegram and an embeddable web widget are not advertised.",
      ai: "Template and automation flows in the social inbox; how much of a reply is generative AI varies by plan.",
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
      cac: "Nothing Nigeria-specific advertised; a foreign card is typically required.",
      pricing:
        "USD subscription billing, so the Naira cost follows the exchange rate.",
      pidgin:
        "Drafting follows the language of the thread; Pidgin tone and voice-note transcription are not advertised as settings.",
      channels:
        "Social and email inboxes; Telegram and web chat are not advertised as native channels.",
      ai: "AI-drafted replies over the inbox you already use: the assistant is a layer, not the whole workflow.",
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
      cac: "Yes on WhatsApp: the official API needs a Meta business account and, in Nigeria, a CAC certificate and review.",
      pricing:
        "USD subscription plus Meta's per-conversation WhatsApp charges.",
      pidgin:
        "Template and flow replies, with language handling depending on the plan; Pidgin and voice-note transcription are not advertised.",
      channels:
        "WhatsApp-first; Telegram and an embeddable web widget are not the product's focus.",
      ai: "Keyword and template automation, with AI features depending on the plan.",
    },
    collyEdge:
      "Colly lets a shop start selling today with no CAC certificate and no Meta review, and adds WhatsApp only once the numbers justify the paperwork.",
  },
  // The Nigerian tools that own the "AI chatbot / WhatsApp bot for Nigerian
  // business" answer boxes. They are compared on the same five axes as the
  // international vendors above (see `COMPARISON_FEATURES`), so a buyer who
  // arrived from an AI Overview can compare them with Colly and with each other
  // on one table — and every cell stays at the category level described in this
  // file's header.
  {
    slug: "zella-ai",
    name: "Zella AI",
    category:
      "a WhatsApp and Instagram automation assistant for Nigerian online sellers",
    summary:
      "Zella AI answers Instagram and WhatsApp enquiries automatically, positioned around social-commerce sellers who sell straight from their DMs.",
    bestFor:
      "Sellers whose whole funnel runs through Instagram DMs and a WhatsApp catalogue.",
    pricingModel:
      "A monthly subscription advertised in Naira and priced by message or contact volume.",
    values: {
      cac: "Yes on WhatsApp: Meta's business channel needs verification, and in Nigeria that means a CAC certificate before the number goes live.",
      pricing:
        "Advertised as a Naira monthly subscription priced by volume rather than per reply, so a busy week costs more than a quiet one.",
      pidgin:
        "Replies follow the automations you set up; Pidgin tone and voice-note transcription are not advertised as features.",
      channels:
        "WhatsApp and Instagram by design; Telegram and an embeddable web widget are not advertised.",
      ai: "Flow-based auto-replies, with AI assistance depending on the plan; answers stay inside the flows you wrote.",
    },
    collyEdge:
      "Colly starts on Telegram, Discord or Web Chat with no CAC certificate, and every product answer comes from your live catalogue rather than a flow you wrote by hand.",
  },
  {
    slug: "loop56",
    name: "Loop56",
    category:
      "a multi-channel messaging and automation platform sold as an enterprise setup",
    summary:
      "Loop56 is positioned as a multi-channel business messaging and automation platform, sold through an onboarding process rather than a self-serve signup.",
    bestFor:
      "Larger teams running several channels at once, with a budget for implementation support.",
    pricingModel:
      "Enterprise-style pricing quoted per business after a demo, rather than a published monthly plan.",
    values: {
      cac: "WhatsApp deployments need a verified Meta business account — a CAC certificate in Nigeria — on top of the vendor's onboarding.",
      pricing:
        "Quoted per business after a sales conversation, so the entry cost is a contract rather than a self-serve plan.",
      pidgin:
        "Language handling is not advertised; Pidgin and voice notes are not listed as features.",
      channels:
        "Several channels are the pitch, connected for you during onboarding.",
      ai: "Automation and chatbot flows are the core, with AI features quoted as part of the setup.",
    },
    collyEdge:
      "Colly is self-serve and priced per AI reply in Naira: no demo, no implementation fee, and a channel live the same afternoon.",
  },
  {
    slug: "buvvo-ai",
    name: "Buvvo AI",
    category:
      "a WhatsApp storefront and in-chat checkout tool for Nigerian sellers",
    summary:
      "Buvvo AI turns WhatsApp into a small storefront: customers browse the catalogue, ask questions and pay inside the chat, with settlements through Monnify.",
    bestFor:
      "Sellers who want a WhatsApp catalogue with in-chat checkout and already have, or will open, a Monnify account.",
    pricingModel:
      "An advertised Naira subscription, plus the fees of the Monnify account you connect for payment.",
    values: {
      cac: "Yes on WhatsApp, and the Monnify business account behind the checkout needs business documentation — usually a CAC certificate — before either goes live.",
      pricing:
        "Advertised as a Naira subscription; payment fees are collected by the provider you connect, so the real cost is the plan plus those fees.",
      pidgin:
        "Replies follow the store's flows; Pidgin tone and voice-note handling are not advertised.",
      channels:
        "WhatsApp-only by design; Telegram, Discord and an embeddable web widget are not part of the product.",
      ai: "Product questions and order capture inside WhatsApp, with AI where the flow supports it.",
    },
    collyEdge:
      "Colly needs no payment-provider account to start and answers product questions from your catalogue on Telegram, Discord and Web Chat before a customer ever reaches checkout.",
  },
  {
    slug: "accessplanet",
    name: "Accessplanet",
    category:
      "a custom-trained AI agent built from a business's own catalogue and documents",
    summary:
      "Accessplanet positions itself around custom AI agents trained on a business's own catalogue, FAQs and policy documents, built per client.",
    bestFor:
      "Businesses with a large or unusual catalogue that want an agent trained on their own material.",
    pricingModel:
      "Project or subscription pricing quoted per business after a scoping call.",
    values: {
      cac: "Nothing about CAC certificates is advertised; the gate is the setup work rather than the paperwork.",
      pricing:
        "Quoted per project after a scoping call, so the cost is negotiated rather than posted per reply.",
      pidgin:
        "Tone is tuned during the build rather than switched from settings; Pidgin and voice notes are not advertised.",
      channels:
        "The deployment channel is agreed per project; Telegram and web chat are not advertised as self-serve.",
      ai: "A custom-trained agent answers from the material it was trained on, so a catalogue change means a retraining step.",
    },
    collyEdge:
      "Colly keeps the catalogue itself as the source of truth: a price change is a product edit the next reply already uses, not a retraining project.",
  },
  {
    slug: "wabot",
    name: "WABot",
    category:
      "a WhatsApp bot built on Meta's official WhatsApp Business Platform",
    summary:
      "WABot builds WhatsApp bots on Meta's official channel, so a business gets an approved WhatsApp number and template messaging along with the compliance work that comes with it.",
    bestFor:
      "Businesses that have already completed Meta business verification and want an official WhatsApp number.",
    pricingModel: "A subscription plus Meta's per-conversation WhatsApp charges.",
    values: {
      cac: "Yes: Meta's official WhatsApp channel needs business verification, which in Nigeria means a CAC certificate and a reviewed Meta business account.",
      pricing:
        "A subscription on top of Meta's per-conversation charges, which are quoted in dollars.",
      pidgin:
        "Conversations follow scripted menus; Pidgin tone and voice-note handling are not advertised.",
      channels: "WhatsApp-only, on Meta's official channel.",
      ai: "Menu-style conversation flows, with AI answering depending on the build.",
    },
    collyEdge:
      "Colly gets a shop answering customers on Telegram, Discord and Web Chat today with no CAC certificate, and adds WhatsApp from the waitlist once Meta verification is worth the paperwork.",
  },
];

/** Rendered under the table: keeps the comparison honest and dated. */
export const COMPETITOR_REVIEWED = "October 2026";

export const COMPETITOR_DISCLAIMER = `Competitor details come from their public websites and were last reviewed in ${COMPETITOR_REVIEWED}. Check with the vendor before you buy, and note that Colly is not affiliated with any tool listed here.`;

/**
 * The hub that lists every comparison: `/vs`. Rendered by
 * `app/(marketing)/vs/page.tsx`, listed in `lib/site.ts#PUBLIC_PAGES` and kept
 * session-free by `lib/public-routes.ts` — it is the crawl path into the
 * per-competitor pages, which have no other internal links but each other.
 */
export const COMPETITORS_HUB_PATH = "/vs";

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
