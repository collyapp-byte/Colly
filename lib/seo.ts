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
import { MARKETING_FAQS, type MarketingFaq } from "@/lib/marketing-faq";
import { PLANS, type PlanTier } from "@/lib/plans";
import {
  OG_IMAGE,
  SITE_BRAND,
  SITE_DESCRIPTION,
  SITE_EMAIL,
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
 * The publisher, emitted once in the root layout. `name` is "Colly Nigeria" and
 * `alternateName` keeps the short brand, which is how the Nigerian entity is
 * separated from unrelated products that share the name.
 */
export function organizationJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: SITE_BRAND,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
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
  };
}

/** The site itself: names the entity behind the URL without a SearchAction. */
export function websiteJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: SITE_BRAND,
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
    // is listed as an alias next to the descriptive marketing name.
    alternateName: ["Colly AI", "Colly AI Sales Assistant"],
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "AI sales and customer service assistant",
    operatingSystem: "Web, Telegram, Discord",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
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
 * Everything the landing page publishes as structured data, in one document:
 * the SoftwareApplication (which already carries one `Offer` per paid tier
 * inside its AggregateOffer) followed by the FAQPage built from the answers the
 * page renders further down.
 *
 * Kept as an array so `JsonLd` can emit a single `<script>` block: an AI answer
 * engine reads the product and the FAQ from one parse, and `/` never repeats a
 * node. Both halves are still built by the functions above, so prices keep
 * coming from `lib/plans.ts` and the answers from `lib/marketing-faq.ts`.
 */
export function homepageJsonLd(): JsonLdNode[] {
  return [softwareApplicationJsonLd(), faqJsonLd()];
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
