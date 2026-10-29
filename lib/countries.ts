/**
 * The countries with a programmatic landing page: `/countries/[country]`.
 *
 * Same contract as `lib/locations.ts`, one level up: one row here is the whole
 * page. `app/(marketing)/countries/[country]/page.tsx` prerenders a page per
 * entry (`generateStaticParams`), `lib/site.ts` puts it in the sitemap,
 * `lib/public-routes.ts` keeps it reachable without a session and
 * `lib/seo.ts#countryJsonLd` publishes the `Country` node an answer engine reads
 * before it will answer "does Colly AI work in Ghana?".
 *
 * The country pages deliberately do **not** claim local pricing. Colly sells one
 * Naira price list through Paystack, so `currency` exists to say plainly which
 * currency the buyer's bank settles in — never to invent a per-country price.
 * Likewise the copy stays away from market-size statistics we cannot source: a
 * made-up number is the fastest way to lose the citation these pages exist for.
 *
 * Dependency-free on purpose: `lib/site.ts` imports this module, and that module
 * is reachable from the proxy's import graph (`lib/public-routes.ts`).
 */

export type Country = {
  /** URL segment and `[country]` param, e.g. `south-africa`. Lowercase, hyphenated. */
  slug: string;
  /** Display name used in headings, copy and structured data. */
  name: string;
  /** ISO 4217 code of the currency the buyer's bank settles the Naira charge in. */
  currency: string;
  /** One honest sentence of local context: how shops here actually sell. */
  intro: string;
  /**
   * City landing pages that sit inside this country, for internal links and
   * `containedInPlace` relevance. Slugs must exist in `lib/locations.ts`.
   */
  cities: readonly string[];
};

export const COUNTRIES: readonly Country[] = [
  {
    slug: "nigeria",
    name: "Nigeria",
    currency: "NGN",
    intro:
      "Nigeria is Colly's home market: the Naira price list, the Pidgin tone and the Telegram-first setup were all built here, from Computer Village traders to Lekki boutiques.",
    cities: [
      "lagos",
      "abuja",
      "port-harcourt",
      "ibadan",
      "kano",
      "enugu",
    ],
  },
  {
    slug: "ghana",
    name: "Ghana",
    currency: "GHS",
    intro:
      "Ghanaian shops sell the same way Colly was built around: a price quoted in a chat, then delivery arranged in the same thread, with the owner stepping in when the buyer is ready to pay.",
    cities: [],
  },
  {
    slug: "kenya",
    name: "Kenya",
    currency: "KES",
    intro:
      "Kenyan businesses often run the shop and the customer chat on the same phone, so Colly keeps the catalogue answers, the floor price and the owner alerts in one dashboard.",
    cities: [],
  },
  {
    slug: "south-africa",
    name: "South Africa",
    currency: "ZAR",
    intro:
      "South African shops use the assistant for the repetitive part first, price, stock and delivery questions, then take the order over themselves once a customer is ready to buy.",
    cities: [],
  },
];

/** Root-relative URL of a country landing page. */
export function countryPath(slug: string): string {
  return `/countries/${slug}`;
}

/** The country behind a `[country]` segment, or `undefined` for an unknown slug. */
export function getCountry(slug: string): Country | undefined {
  return COUNTRIES.find((country) => country.slug === slug);
}
