/**
 * Metadata and JSON-LD builders for the public site.
 *
 * Everything here is pure: given the same inputs it returns plain objects, so
 * `tests/seo.test.ts` can assert that prices, plan counts and FAQ answers in the
 * structured data still match `lib/plans.ts` and `lib/marketing-faq.ts`.
 *
 * Prices are read from `lib/plans.ts` and never typed by hand. A schema that
 * advertises a price the checkout does not charge is worse than no schema.
 */

import type { Metadata } from "next";
import { ACADEMY_COURSES } from "@/lib/academy-catalogue";
import {
  COMPARISON_FEATURES,
  COMPETITORS,
  COMPETITORS_HUB_PATH,
  COMPETITOR_REVIEWED,
  comparisonAnswer,
  competitorPath,
  type Competitor,
} from "@/lib/competitors";
import { COUNTRIES, countryPath, type Country } from "@/lib/countries";
import { formatNaira } from "@/lib/format";
import {
  LOCATIONS,
  LOCATIONS_HUB_PATH,
  locationPath,
  type Location,
} from "@/lib/locations";
import { MARKETING_FAQS, type MarketingFaq } from "@/lib/marketing-faq";
import { PLANS, type PlanTier } from "@/lib/plans";
import {
  OG_IMAGE,
  SITE_BRAND,
  SITE_DESCRIPTION,
  SITE_DISAMBIGUATION,
  SITE_EMAIL,
  SITE_ENTITY_ALIAS,
  SITE_LANGUAGE,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";

/** A JSON-LD document. Typed loosely on purpose: schema.org keys are open. */
export type JsonLdNode = Record<string, unknown>;

/** Stable `@id`s so each node can reference the others instead of repeating. */
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SOFTWARE_ID = `${SITE_URL}/#software`;

const PLAN_TIERS = Object.keys(PLANS) as PlanTier[];

/** What the assistant actually does, in the customer's words. */
const SOFTWARE_FEATURES = [
  "Replies to customers on Telegram, Discord and Web Chat",
  "English and Nigerian Pidgin tone options",
  "Catalogue-aware answers with live prices and stock",
  "Negotiation that never drops below the owner's floor price",
  "Shares the owner's payment instructions and escalates when a human is needed",
  "Manual replies are free; AI replies cost 5 credits (80 on WhatsApp)",
];

/**
 * Colly's off-site footprint. `sameAs` is how search and AI answer engines tie
 * the site to the same entity elsewhere on the web, which is what stops "Colly"
 * being merged with the footballer or the industrial equipment company that
 * share the name. The profiles are listed before they go live so the entity
 * graph keeps a stable shape once they exist.
 */
const ORGANIZATION_SAME_AS: string[] = [
  "https://www.linkedin.com/company/colly-ai",
  "https://x.com/colly_ai",
  "https://github.com/collyapp-byte/Colly",
];

/** What the company is an authority on, so the entity reads as a software vendor. */
const ORGANIZATION_KNOWS_ABOUT: string[] = [
  "Artificial Intelligence",
  "Customer Service Automation",
  "Sales Automation",
  "Nigerian SMEs",
];

function planName(tier: PlanTier): string {
  return `${SITE_BRAND} ${tier[0].toUpperCase()}${tier.slice(1)} plan (monthly)`;
}

/** One `Offer` per paid tier, priced from `lib/plans.ts`. */
function planOffers(): JsonLdNode[] {
  return PLAN_TIERS.map((tier) => {
    const plan = PLANS[tier];

    return {
      "@type": "Offer",
      name: planName(tier),
      description: plan.description,
      price: String(plan.monthly),
      priceCurrency: "NGN",
      category: "subscription",
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/pricing"),
    };
  });
}

/**
 * The publisher, emitted once in the root layout. `name` is "Colly Nigeria",
 * `alternateName` carries the short brand plus the "Colly AI Software" alias,
 * and `disambiguatingDescription` states the entity type in plain words, so
 * search and AI answer engines do not merge the company with the footballer or
 * the industrial equipment company that share the name.
 */
export function organizationJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    // "Colly" alone collides with a footballer and an industrial equipment
    // company, so the alias spells out the entity type.
    alternateName: [SITE_BRAND, SITE_ENTITY_ALIAS],
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    disambiguatingDescription: SITE_DISAMBIGUATION,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo.png"),
      width: 400,
      height: 400,
      caption: SITE_NAME,
    },
    email: SITE_EMAIL,
    areaServed: { "@type": "Country", name: "Nigeria" },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SITE_EMAIL,
      areaServed: "NG",
      availableLanguage: ["English", "Nigerian Pidgin"],
    },
    // Off-site profiles and expertise: together with the aliases above they
    // tell crawlers this is a Nigerian software company and not one of the
    // unrelated namesakes.
    sameAs: ORGANIZATION_SAME_AS,
    knowsAbout: ORGANIZATION_KNOWS_ABOUT,
  };
}

/** The site itself: names the entity behind the URL without a SearchAction. */
export function websiteJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: [SITE_BRAND, SITE_ENTITY_ALIAS],
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": ORGANIZATION_ID },
  };
}


/**
 * The product. The landing page emits the aggregate price range; `/pricing`
 * passes `{ itemisedOffers: true }` to list each tier as its own `Offer`.
 */
export function softwareApplicationJsonLd(options?: {
  itemisedOffers?: boolean;
}): JsonLdNode {
  const monthly = PLAN_TIERS.map((tier) => PLANS[tier].monthly);
  const offers = planOffers();

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_ID,
    name: SITE_NAME,
    // "Colly AI" is the exact phrase buyers type into ChatGPT/Perplexity, so it
    // is listed as an alias next to the descriptive marketing name. The
    // "Colly AI Software" alias pins the entity type, which keeps the product
    // apart from the footballer and the industrial equipment company.
    alternateName: ["Colly AI", SITE_ENTITY_ALIAS, "Colly AI Sales Assistant"],
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "AI sales and customer service assistant",
    operatingSystem: "Web, Telegram, Discord",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    disambiguatingDescription: SITE_DISAMBIGUATION,
    inLanguage: SITE_LANGUAGE,
    featureList: SOFTWARE_FEATURES,
    isAccessibleForFree: true,
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    offers: options?.itemisedOffers
      ? offers
      : {
          "@type": "AggregateOffer",
          priceCurrency: "NGN",
          lowPrice: String(Math.min(...monthly)),
          highPrice: String(Math.max(...monthly)),
          offerCount: String(monthly.length),
          offers,
        },
    areaServed: { "@type": "Country", name: "Nigeria" },
  };
}

/**
 * The FAQ answers rendered on the landing page, as a FAQPage. The questions and
 * answers come from the same module the accordion renders.
 */
export function faqJsonLd(
  faqs: readonly MarketingFaq[] = MARKETING_FAQS,
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

/**
 * What the landing page publishes as structured data: the SoftwareApplication,
 * which already carries one `Offer` per paid tier inside its AggregateOffer.
 *
 * The FAQPage node lives with the answers now — `components/marketing/faq.tsx`
 * renders it from the same array it displays — so `/` ships exactly one FAQPage
 * instead of two, and the schema is read where the copy is written.
 */
export function homepageJsonLd(): JsonLdNode[] {
  return [softwareApplicationJsonLd()];
}

/**
 * The meta description for a city landing page, shared by `generateMetadata`
 * and `locationJsonLd` so the snippet and the schema say the same thing.
 */
export function locationDescription(location: Location): string {
  return `AI sales assistant for ${location.city} businesses: Colly replies 24/7 on Telegram, Discord and Web Chat in English or Nigerian Pidgin, from ${formatNaira(
    PLANS.green.monthly,
  )} a month.`;
}

/**
 * The meta description for a country landing page, shared by
 * `generateMetadata` and `countryJsonLd` so the snippet and the schema say the
 * same thing. Same price, same channels, same languages as everywhere else —
 * nothing in it is per-country, because nothing in the price list is.
 */
export function countryDescription(country: Country): string {
  return `AI sales assistant for businesses in ${country.name}: Colly replies 24/7 on Telegram, Discord and Web Chat in English or Nigerian Pidgin, from ${formatNaira(
    PLANS.green.monthly,
  )} a month.`;
}

/**
 * The shell shared by both programmatic place pages (`/locations/[city]` and
 * `/countries/[country]`): a WebPage whose `mainEntity` is the Service, pointed
 * at the place through `areaServed`, priced from `lib/plans.ts`, with a
 * breadcrumb so the page has a place in the site hierarchy.
 *
 * `areaServed` is the part that matters for GEO — it lets an answer engine reply
 * "Colly AI is available in Lagos" (or "in Ghana") with a citation instead of
 * inferring it from the title.
 */
function placePageJsonLd({
  url,
  name,
  description,
  serviceName,
  breadcrumbName,
  areaServed,
}: {
  url: string;
  name: string;
  description: string;
  serviceName: string;
  breadcrumbName: string;
  /** A `City` or `Country` node, or an `@id` reference to a full node. */
  areaServed: JsonLdNode;
}): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORGANIZATION_ID },
    mainEntity: {
      "@type": "Service",
      name: serviceName,
      serviceType: "AI sales and customer service assistant",
      provider: { "@id": ORGANIZATION_ID },
      areaServed,
      offers: {
        "@type": "Offer",
        price: String(PLANS.green.monthly),
        priceCurrency: "NGN",
        url: absoluteUrl("/pricing"),
      },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: breadcrumbName, item: url },
      ],
    },
  };
}

/**
 * A city landing page: which service, where, and at what price.
 *
 * Delegates the WebPage/Service/Offer/breadcrumb shell to `placePageJsonLd`, so
 * a country page publishes exactly the same structure one level up.
 */
export function locationJsonLd(location: Location): JsonLdNode {
  const url = absoluteUrl(locationPath(location.slug));

  return placePageJsonLd({
    url,
    name: `AI Sales Assistant for Businesses in ${location.city}`,
    description: locationDescription(location),
    serviceName: `Colly AI sales assistant in ${location.city}`,
    breadcrumbName: location.city,
    areaServed: {
      "@type": "City",
      name: location.city,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: location.state,
      },
    },
  });
}

/**
 * A country landing page, as the two nodes the page publishes:
 *
 * 1. a `Country` node — the entity itself, so an answer engine can answer "is
 *    Colly AI available in Kenya?" from the markup rather than by inferring it
 *    from the copy, and so the country has a stable `@id` other nodes can cite;
 * 2. the same WebPage/Service shell the city pages use, with `areaServed`
 *    pointing at that `@id` and the Naira offer from `lib/plans.ts`.
 *
 * Returned as an array (one `<script type="application/ld+json">` graph) so a
 * country page carries both facts without duplicating the service markup.
 */
export function countryJsonLd(country: Country): JsonLdNode[] {
  const url = absoluteUrl(countryPath(country.slug));
  const countryId = `${url}#country`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "Country",
      "@id": countryId,
      name: country.name,
      description: countryDescription(country),
      url,
      containedInPlace: { "@type": "Continent", name: "Africa" },
    },
    placePageJsonLd({
      url,
      name: `AI Sales Assistant for Businesses in ${country.name}`,
      description: countryDescription(country),
      serviceName: `Colly AI sales assistant in ${country.name}`,
      breadcrumbName: country.name,
      areaServed: {
        "@type": "Country",
        "@id": countryId,
        name: country.name,
      },
    }),
  ];
}

/**
 * The comparison page as data: two `SoftwareApplication` nodes side by side,
 * each carrying one `additionalProperty` per table row, wrapped in an ItemList.
 *
 * This is the shape an AI Overview can read without parsing the HTML table: the
 * axes come from `COMPARISON_FEATURES`, the answers from the same competitor
 * record the table renders, and Colly's Naira price from `lib/plans.ts`.
 */
export function comparisonJsonLd(competitor: Competitor): JsonLdNode {
  const url = absoluteUrl(competitorPath(competitor.slug));

  const additionalProperties = (
    values: readonly string[],
  ): JsonLdNode[] =>
    COMPARISON_FEATURES.map((feature, index) => ({
      "@type": "PropertyValue",
      name: feature.label,
      value: values[index],
    }));

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: `Colly AI vs ${competitor.name}`,
    description: comparisonAnswer(competitor),
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORGANIZATION_ID },
    mainEntity: {
      "@type": "ItemList",
      name: `Colly AI compared with ${competitor.name}`,
      numberOfItems: 2,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "SoftwareApplication",
            "@id": SOFTWARE_ID,
            name: SITE_NAME,
            alternateName: ["Colly AI", SITE_ENTITY_ALIAS],
            applicationCategory: "BusinessApplication",
            description: SITE_DESCRIPTION,
            additionalProperty: additionalProperties(
              COMPARISON_FEATURES.map((feature) => feature.colly),
            ),
          },
        },
        {
          "@type": "ListItem",
          position: 2,
          item: {
            "@type": "SoftwareApplication",
            name: competitor.name,
            applicationCategory: "BusinessApplication",
            description: competitor.summary,
            additionalProperty: additionalProperties(
              COMPARISON_FEATURES.map(
                (feature) => competitor.values[feature.id],
              ),
            ),
          },
        },
      ],
    },
  };
}

/** "A, B and C" — reads like prose in a meta description, unlike a bare join. */
function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The meta description for the `/vs` hub, shared by `generateMetadata` and
 * `comparisonHubJsonLd` so the snippet and the schema cannot disagree. The
 * competitors are named from `lib/competitors.ts` and the review date from
 * `COMPETITOR_REVIEWED`, so adding a vendor updates both.
 */
export function comparisonHubDescription(): string {
  const names = COMPETITORS.map((competitor) => competitor.name);

  return `Colly AI compared with ${listNames(
    names,
  )} on the five things a buyer checks: AI depth, Naira pricing, Jiji catalogue sync, channels and CAC paperwork. Colly plans start at ${formatNaira(
    PLANS.green.monthly,
  )} a month; competitor details come from their public websites, last reviewed in ${COMPETITOR_REVIEWED}.`;
}

/**
 * The meta description for the `/locations` hub: every city and country that
 * has a landing page, counted from the data modules rather than typed, plus the
 * one Naira price list they all share.
 */
export function placesHubDescription(): string {
  return `Colly AI for businesses in ${LOCATIONS.length} Nigerian cities (${listNames(
    LOCATIONS.map((location) => location.city),
  )}) and in ${COUNTRIES.length} countries (${listNames(
    COUNTRIES.map((country) => country.name),
  )}), on one Naira price list from ${formatNaira(
    PLANS.green.monthly,
  )} a month.`;
}

/**
 * The `/vs` hub as a `CollectionPage`: an ItemList of every comparison page.
 *
 * One comparison page links to the others, but nothing linked to *all* of them
 * from a single crawlable URL until this hub — the schema states the same set
 * the cards render, so the list a crawler reads is the list a visitor sees.
 */
export function comparisonHubJsonLd(): JsonLdNode {
  const url = absoluteUrl(COMPETITORS_HUB_PATH);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#webpage`,
    url,
    name: "Colly AI vs Competitors",
    description: comparisonHubDescription(),
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORGANIZATION_ID },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Comparisons", item: url },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      name: "Colly AI comparisons",
      numberOfItems: COMPETITORS.length,
      itemListElement: COMPETITORS.map((competitor, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "WebPage",
          name: `Colly AI vs ${competitor.name}`,
          description: comparisonAnswer(competitor),
          url: absoluteUrl(competitorPath(competitor.slug)),
        },
      })),
    },
  };
}

/**
 * The `/locations` hub as a `CollectionPage`: one ItemList of every place page,
 * countries first (the parent level) and then the cities inside them.
 *
 * Each item carries its real `@type` (`Country` or `City`) and the absolute URL
 * of its landing page, so an answer engine reading the hub learns both the
 * coverage and where the evidence for it lives.
 */
export function placesHubJsonLd(): JsonLdNode {
  const url = absoluteUrl(LOCATIONS_HUB_PATH);
  const places = [
    ...COUNTRIES.map((country) => ({
      type: "Country",
      name: country.name,
      url: absoluteUrl(countryPath(country.slug)),
    })),
    ...LOCATIONS.map((location) => ({
      type: "City",
      name: location.city,
      url: absoluteUrl(locationPath(location.slug)),
    })),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#webpage`,
    url,
    name: "AI Sales Assistant by City and Country",
    description: placesHubDescription(),
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORGANIZATION_ID },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Locations", item: url },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      name: "Where Colly AI works",
      numberOfItems: places.length,
      itemListElement: places.map((place, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: { "@type": place.type, name: place.name, url: place.url },
      })),
    },
  };
}

/** The four academy courses, so search engines can read the curriculum. */
export function academyJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Colly Agent Academy courses",
    itemListElement: ACADEMY_COURSES.map((course, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Course",
        name: course.title,
        description: course.summary,
        inLanguage: SITE_LANGUAGE,
        provider: { "@id": ORGANIZATION_ID },
      },
    })),
  };
}

export type PageMetadataInput = {
  /** Page title, without the brand suffix unless `absoluteTitle` is set. */
  title: string;
  description: string;
  /** Root-relative path; drives the canonical URL and `og:url`. */
  path: string;
  /** Skip the root template when the title already carries the brand. */
  absoluteTitle?: boolean;
  /** Private or duplicate pages: ask crawlers to drop them. */
  noIndex?: boolean;
  keywords?: string[];
};

/**
 * Builds a complete, self-referential metadata object for one public page.
 *
 * Canonicals are absolute (not left to `metadataBase`) so a page served from a
 * preview host can never claim to be the production copy.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noIndex = false,
  keywords,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl(OG_IMAGE.path);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      images: [
        {
          url: image,
          width: OG_IMAGE.width,
          height: OG_IMAGE.height,
          type: OG_IMAGE.type,
          alt: OG_IMAGE.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt: OG_IMAGE.alt }],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
