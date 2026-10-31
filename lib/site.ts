/**
 * Site identity and canonical-URL helpers: the single source of truth for
 * metadata, JSON-LD, `sitemap.xml` and `robots.txt`.
 *
 * The production origin is `https://colly.com.ng`. `NEXT_PUBLIC_APP_URL` (the
 * documented deploy URL already used for Paystack callbacks and the Telegram
 * webhook) wins when it is set, so a staging deployment emits self-referential
 * canonicals and a sitemap for its own host instead of pointing at production.
 *
 * Server-only by convention: nothing here is a "use client" concern, and the
 * framework inlines `NEXT_PUBLIC_*` at build time.
 */

import {
  COMPETITORS,
  COMPETITORS_HUB_PATH,
  competitorPath,
} from "@/lib/competitors";
import { COUNTRIES, countryPath } from "@/lib/countries";
import { LOCATIONS, LOCATIONS_HUB_PATH, locationPath } from "@/lib/locations";

/** The production host, used when `NEXT_PUBLIC_APP_URL` is not configured. */
export const SITE_DOMAIN = "colly.com.ng";

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const url =
    configured && configured.length > 0 ? configured : `https://${SITE_DOMAIN}`;
  // Canonical URLs are compared as strings by crawlers, so drop any trailing
  // slash: `absoluteUrl("/pricing")` must never emit a double slash.
  return url.replace(/\/+$/, "");
}

/** Canonical origin of this deployment, without a trailing slash. */
export const SITE_URL = resolveSiteUrl();

/** Structured-data name. "Nigeria" separates Colly from unrelated namesakes. */
export const SITE_NAME = "Colly Nigeria";

/** Short brand name, used where a legal-style name would read oddly. */
export const SITE_BRAND = "Colly";

/**
 * Schema alias that spells out the entity type. "Colly AI" on its own
 * collides with a footballer and an industrial equipment company, so the
 * structured data also publishes "Colly AI Software".
 */
export const SITE_ENTITY_ALIAS = "Colly AI Software";

/**
 * Plain-language disambiguation for JSON-LD `disambiguatingDescription`:
 * the entity type first, then the namesakes Colly must not be merged with.
 */
export const SITE_DISAMBIGUATION =
  "Colly AI is a Nigerian software company that builds AI sales assistants for small businesses. It is not affiliated with any footballer, industrial equipment company, or any other business or individual using the name Colly.";

export const SITE_EMAIL = "support@colly.com.ng";

/** Open Graph locale and BCP-47 language tag for the Nigerian market. */
export const SITE_LOCALE = "en_NG";
export const SITE_LANGUAGE = "en-NG";

export const SITE_TITLE_DEFAULT =
  "Colly | AI Sales & Customer Service Assistant for Nigerian Businesses";

/** Root title template: every page renders "<page> | Colly Nigeria". */
export const SITE_TITLE_TEMPLATE = "%s | Colly Nigeria";

/**
 * Entity-first site description, reused by metadata, Open Graph and JSON-LD.
 * The first sentence names the entity type ("Nigerian software company"),
 * which is what separates Colly from the footballer and the industrial
 * equipment company that share the name.
 */
export const SITE_DESCRIPTION =
  "Colly AI is a Nigerian software company that builds an AI sales assistant for small businesses. It replies to customers 24/7 on Telegram, Discord and Web Chat in English or Nigerian Pidgin, quotes your catalogue prices, never goes below your floor price, and hands the chat to you when a human is needed. Start free with 80 AI credits every month.";

export const SITE_KEYWORDS = [
  "AI sales assistant Nigeria",
  "AI customer service Nigeria",
  "Telegram sales bot Nigeria",
  "Nigerian Pidgin AI assistant",
  "SME customer service automation",
  "Colly Nigeria",
  "business AI assistant Lagos",
  "Paystack AI sales assistant",
  "WhatsApp alternative sales assistant",
];

/**
 * The social card. `og-image.png` ships in `public/`, so the URL is
 * root-relative here and resolved with `absoluteUrl()` wherever it is emitted —
 * both metadata and JSON-LD need an absolute image URL.
 *
 * The declared size must match the shipped file byte for byte: Facebook's
 * Sharing Debugger and Twitter's card validator both flag a mismatch, and some
 * consumers lay the card out from these numbers instead of fetching it first.
 * `tests/seo.test.ts` reads the PNG header and fails if the two drift.
 *
 * The artwork is a designed 16:9 banner (headline, logo and URL in the corners),
 * so it is published at its native size rather than cropped to the 1.91:1 that
 * `summary_large_image` prefers — a 1200×630 crop would clip the headline and
 * cut the `colly.com.ng` wordmark. 16:9 is inside the card validators' 2:1
 * (Twitter) / 3:1 (Open Graph) aspect-ratio limits.
 */
export const OG_IMAGE = {
  path: "/og-image.png",
  width: 1920,
  height: 1080,
  type: "image/png",
  alt: "Colly Nigeria — AI sales and customer service assistant for Nigerian businesses",
} as const;

/** Absolute URL for a root-relative path. `/` (or "") is the origin itself. */
export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** `changeFrequency` values accepted by `MetadataRoute.Sitemap`. */
export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export type PublicPage = {
  /** Root-relative path, e.g. `/pricing`. */
  path: string;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
};

/**
 * Every page a crawler should index, in descending priority. Deliberately only
 * pages that are reachable without a session:
 *
 * - the dashboard (`/dashboard`, `/settings/*`, `/products`, …) and the agent
 *   area (`/agents/*`) sit behind `requireAuth()` / `requireAgent()`;
 * - `/login`, `/signup` and the password flows are thin auth screens and are
 *   marked `noindex` (see the `(auth)` layout);
 * - `/chat/[businessId]` is a per-business customer widget;
 * - `/verify/[agentNumber]` is generated per agent, so it is crawlable but not
 *   listed here (a sitemap cannot enumerate it without a database query).
 *
 * `tests/seo.test.ts` checks that nothing in `robots.ts` blocks these paths, and
 * that the proxy (`lib/public-routes.ts`, which derives its marketing/legal
 * entries from this list) lets a signed-out visitor reach every one of them — a
 * sitemap URL that redirects to `/login` is invisible to crawlers.
 */
export const PUBLIC_PAGES: readonly PublicPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
  { path: "/academy", changeFrequency: "monthly", priority: 0.8 },
  // Industry landing pages (`/hotels` is the first): one page per vertical, and
  // the only front door that carries `?industry=…` into signup. Same priority as
  // `/academy` keeps the list non-increasing, which `tests/seo.test.ts` asserts.
  { path: "/hotels", changeFrequency: "monthly", priority: 0.8 },
  // Programmatic GEO pages: city, country and competitor landing pages. Every
  // list is derived from its data module, so a new city, country or competitor
  // is one object away from being in the sitemap, the public-route allowlist
  // (`lib/public-routes.ts`) and the per-page canonical.
  //
  // The two hubs (`/locations`, `/vs`) index those lists for a crawler — the
  // leaf pages mostly link sideways to their siblings — and carry the same
  // priority as the pages beneath them. Keeping each hub directly above its
  // leaves is what preserves the non-increasing priority order that
  // `tests/seo.test.ts` asserts.
  { path: LOCATIONS_HUB_PATH, changeFrequency: "monthly", priority: 0.7 },
  ...LOCATIONS.map((location) => ({
    path: locationPath(location.slug),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  })),
  ...COUNTRIES.map((country) => ({
    path: countryPath(country.slug),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  })),
  { path: COMPETITORS_HUB_PATH, changeFrequency: "monthly", priority: 0.6 },
  ...COMPETITORS.map((competitor) => ({
    path: competitorPath(competitor.slug),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  })),
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/account/delete", changeFrequency: "yearly", priority: 0.2 },
];

/**
 * Paths `robots.txt` must keep crawlers out of: the signed-in app shell, the
 * agent area (every route there calls `requireAgent()`), the per-business chat
 * widget, the auth screens and the private API surface.
 *
 * Kept beside `PUBLIC_PAGES` so both lists are reviewed together —
 * `tests/seo.test.ts` fails if an entry here shadows a sitemap URL.
 */
export const PRIVATE_PATHS: readonly string[] = [
  "/api/",
  "/auth/",
  "/billing/",
  "/chat/",
  "/agents/",
  "/dashboard",
  "/ai",
  "/conversations",
  "/customers",
  "/invoices",
  "/sales",
  "/products",
  "/faqs",
  "/notifications",
  "/settings",
  "/find-an-agent",
  "/onboarding/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

