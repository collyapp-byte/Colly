/**
 * The cities with a programmatic landing page: `/locations/[city]`.
 *
 * One row here is the whole contract: `app/(marketing)/locations/[city]/page.tsx`
 * prerenders a page per entry (`generateStaticParams`), `lib/site.ts` adds it to
 * the sitemap and the public-route list, and `lib/seo.ts#locationJsonLd` states
 * which city the assistant serves. A new city is one object, never a new page.
 *
 * Keep the copy factual and free of statistics we cannot source: these pages are
 * read by AI answer engines as well as people, and a made-up market size is the
 * fastest way to lose the citation. `areas` lists real, named commercial
 * districts, so the page says something only a local could say.
 *
 * Dependency-free on purpose: `lib/site.ts` imports this module, and that module
 * is reachable from the proxy's import graph (`lib/public-routes.ts`).
 */

export type Location = {
  /** URL segment and `[city]` param, e.g. `lagos`. Lowercase, hyphenated. */
  slug: string;
  /** Display name used in headings, copy and structured data. */
  city: string;
  /** State the city belongs to, for `containedInPlace` in the schema. */
  state: string;
  /** One sentence of local context: what businesses here sell and how they trade. */
  intro: string;
  /** Named markets and districts, used for local relevance in the copy. */
  areas: readonly string[];
};

export const LOCATIONS: readonly Location[] = [
  {
    slug: "lagos",
    city: "Lagos",
    state: "Lagos State",
    intro:
      "Lagos businesses sell across Computer Village, Alaba International Market and the Lekki boutiques, and the customer asking for a price is often on a phone rather than in the shop.",
    areas: [
      "Computer Village, Ikeja",
      "Alaba International Market",
      "Lekki",
      "Yaba",
      "Surulere",
    ],
  },
  {
    slug: "abuja",
    city: "Abuja",
    state: "Federal Capital Territory",
    intro:
      "In Abuja the buyers are spread from Wuse and Garki out to the Kubwa corridor, so most shops close a sale in a chat long before anyone walks into the store.",
    areas: ["Wuse II", "Garki", "Gwarinpa", "Kubwa", "Area 1"],
  },
  {
    slug: "port-harcourt",
    city: "Port Harcourt",
    state: "Rivers State",
    intro:
      "Port Harcourt shops around Mile 1 and Trans Amadi sell to a mix of walk-ins and oil-servicing offices, and the messages keep coming after closing time.",
    areas: ["Mile 1", "Trans Amadi", "Rumuokoro", "GRA", "Elekahia"],
  },
  {
    slug: "ibadan",
    city: "Ibadan",
    state: "Oyo State",
    intro:
      "Ibadan is a trading city: shops in Dugbe, Bodija and Challenge quote prices on Telegram and close delivery details in the same thread.",
    areas: ["Dugbe", "Bodija", "Challenge", "Ring Road", "Mokola"],
  },
  {
    slug: "kano",
    city: "Kano",
    state: "Kano State",
    intro:
      "Kano's wholesale trade runs through Kurmi Market, Sabon Gari and Bompai, where buyers expect a straight answer on price and stock before they commit.",
    areas: ["Kurmi Market", "Sabon Gari", "Bompai", "Nassarawa", "France Road"],
  },
  {
    slug: "enugu",
    city: "Enugu",
    state: "Enugu State",
    intro:
      "Enugu shops around Ogbete Main Market and Independence Layout sell through direct messages first, then deliver across the South East.",
    areas: [
      "Ogbete Main Market",
      "Independence Layout",
      "New Haven",
      "GRA",
      "Abakpa",
    ],
  },
];

/**
 * The hub that lists every city page, and the countries they sit in: `/locations`.
 * `app/(marketing)/locations/page.tsx` renders it, `lib/site.ts` puts it in the
 * sitemap and `lib/public-routes.ts` keeps it reachable without a session.
 */
export const LOCATIONS_HUB_PATH = "/locations";

/** Root-relative URL of a city landing page. */
export function locationPath(slug: string): string {
  return `/locations/${slug}`;
}

/** The city behind a `[city]` segment, or `undefined` for an unknown slug. */
export function getLocation(slug: string): Location | undefined {
  return LOCATIONS.find((location) => location.slug === slug);
}
