/**
 * Generative Engine Optimization (GEO) / Answer Engine Optimization (AEO).
 *
 * Four things are locked here:
 *
 * 1. The programmatic geo pages (city, country and comparison) exist for every
 *    record in their data modules, are in the sitemap, and are reachable without
 *    a session — otherwise a crawler is either told about a page that redirects
 *    to /login or shown a page nobody can index.
 * 2. The JSON-LD those pages publish is built from the same rows the page
 *    renders, and its prices come from `lib/plans.ts`.
 * 3. An unknown slug is a real 404, not a soft one: the proxy answers it before
 *    the prerendered shell streams.
 * 4. The stacked Q&A is quotable: an exact question, then a 40-60 word direct
 *    answer, and one FAQPage built from the very array that is rendered.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  COMPARISON_FEATURES,
  COMPETITORS,
  COMPETITOR_DISCLAIMER,
  comparisonAnswer,
  competitorPath,
  getCompetitor,
} from "../lib/competitors";
import { COUNTRIES, countryPath, getCountry } from "../lib/countries";
import { formatNaira } from "../lib/format";
import { LOCATIONS, getLocation, locationPath } from "../lib/locations";
import { FAQ_ANSWER_WORDS, MARKETING_FAQS } from "../lib/marketing-faq";
import { PLANS, REPLY_CREDIT_COSTS } from "../lib/plans";
import {
  NOT_FOUND_REWRITE_PATH,
  isPublicRoute,
  isUnknownGeoRoute,
} from "../lib/public-routes";
import {
  comparisonJsonLd,
  countryDescription,
  countryJsonLd,
  faqJsonLd,
  locationDescription,
  locationJsonLd,
  pageMetadata,
} from "../lib/seo";
import { PUBLIC_PAGES } from "../lib/site";

/** Whitespace word count — what a model sees when it chunks the paragraph. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

test("every city is prerendered, listed in the sitemap and public", () => {
  assert.ok(LOCATIONS.length >= 6, "the six launch cities must be present");

  const slugs = new Set<string>();

  for (const location of LOCATIONS) {
    assert.match(
      location.slug,
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      `${location.slug} must be a URL-safe slug (it is the generateStaticParams key)`,
    );
    assert.equal(
      slugs.has(location.slug),
      false,
      `duplicate city slug ${location.slug}`,
    );
    slugs.add(location.slug);

    assert.ok(location.city.length > 0);
    assert.ok(location.state.length > 0, "the schema needs containedInPlace");
    assert.ok(
      location.intro.length > 40,
      `${location.city} needs real local context, not a templated sentence`,
    );
    assert.ok(
      location.areas.length >= 3,
      `${location.city} needs named trading areas`,
    );

    assert.deepEqual(getLocation(location.slug), location);
    assert.equal(locationPath(location.slug), `/locations/${location.slug}`);

    // In the sitemap and reachable without a session: a crawler must be able to
    // land on exactly the URL the sitemap advertises.
    assert.ok(
      PUBLIC_PAGES.some((page) => page.path === locationPath(location.slug)),
      `${location.slug} is missing from PUBLIC_PAGES`,
    );
    assert.equal(isPublicRoute(locationPath(location.slug)), true);
  }

  assert.equal(getLocation("atlantis"), undefined);
  // An unlisted city must still be let through to the page rather than bounced
  // to /login (a redirect is a soft 404 to a crawler) — and the proxy turns it
  // into a real 404 before the prerendered shell can stream.
  assert.equal(isPublicRoute("/locations/atlantis"), true);
  assert.equal(isUnknownGeoRoute("/locations/atlantis"), true);
  assert.equal(isUnknownGeoRoute("/locations/lagos"), false);
  // Not a GEO URL: a deeper path, the bare list and an unrelated route are all
  // left to Next's own routing.
  assert.equal(isUnknownGeoRoute("/locations/lagos/lekki"), false);
  assert.equal(isUnknownGeoRoute("/locations"), false);
  assert.equal(isUnknownGeoRoute("/pricing"), false);
});

test("a city page states the city, the state and the live Naira price", () => {
  const lagos = getLocation("lagos");
  assert.ok(lagos, "lagos must be in LOCATIONS");

  const node = locationJsonLd(lagos);
  assert.equal(node["@type"], "WebPage");
  assert.equal(node.name, "AI Sales Assistant for Businesses in Lagos");
  assert.equal(node.description, locationDescription(lagos));

  const service = node.mainEntity as {
    "@type": string;
    areaServed: {
      "@type": string;
      name: string;
      containedInPlace: { "@type": string; name: string };
    };
    offers: { "@type": string; price: string; priceCurrency: string };
  };

  assert.equal(service["@type"], "Service");
  assert.equal(service.areaServed["@type"], "City");
  assert.equal(service.areaServed.name, "Lagos");
  assert.equal(service.areaServed.containedInPlace.name, "Lagos State");
  assert.equal(service.offers.price, String(PLANS.green.monthly));
  assert.equal(service.offers.priceCurrency, "NGN");

  const breadcrumb = node.breadcrumb as {
    "@type": string;
    itemListElement: Array<{ position: number; name: string }>;
  };
  assert.equal(breadcrumb["@type"], "BreadcrumbList");
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.name),
    ["Home", "Lagos"],
  );

  // The page and the schema share one canonical URL.
  const metadata = pageMetadata({
    title: "AI Sales Assistant in Lagos",
    description: node.description as string,
    path: locationPath("lagos"),
  });
  assert.ok(
    String(metadata.alternates?.canonical).endsWith("/locations/lagos"),
    "the canonical must be the city URL, not /",
  );
});

test("every competitor page has a row for every comparison axis", () => {
  assert.ok(COMPETITORS.length >= 3);

  const ids = COMPARISON_FEATURES.map((feature) => feature.id);
  assert.deepEqual([...ids].sort(), ["ai", "cac", "channels", "jiji", "pricing"]);
  assert.equal(new Set(ids).size, ids.length, "no duplicate axis");

  const slugs = new Set<string>();

  for (const competitor of COMPETITORS) {
    assert.match(competitor.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.equal(slugs.has(competitor.slug), false);
    slugs.add(competitor.slug);

    assert.deepEqual(getCompetitor(competitor.slug), competitor);
    assert.equal(competitorPath(competitor.slug), `/vs/${competitor.slug}`);
    assert.ok(
      PUBLIC_PAGES.some((page) => page.path === competitorPath(competitor.slug)),
      `${competitor.slug} is missing from PUBLIC_PAGES`,
    );
    assert.equal(isPublicRoute(competitorPath(competitor.slug)), true);

    for (const feature of COMPARISON_FEATURES) {
      assert.ok(
        competitor.values[feature.id].length > 10,
        `${competitor.slug}/${feature.id} needs a real answer, not a dash`,
      );
    }
  }

  assert.equal(getCompetitor("unknown-tool"), undefined);
  assert.equal(isPublicRoute("/vs/unknown-tool"), true);
  assert.equal(isUnknownGeoRoute("/vs/unknown-tool"), true);
  assert.equal(isUnknownGeoRoute("/vs/dmly"), false);
});

test("the comparison rows quote lib/plans.ts and keep WhatsApp honest", () => {
  const pricing = COMPARISON_FEATURES.find(
    (feature) => feature.id === "pricing",
  );
  const cac = COMPARISON_FEATURES.find((feature) => feature.id === "cac");
  assert.ok(pricing && cac);

  assert.ok(
    pricing.colly.includes(formatNaira(PLANS.green.monthly)),
    "the price row must quote the live Green plan price",
  );
  assert.ok(pricing.colly.includes(String(REPLY_CREDIT_COSTS.standard)));

  // Zero CAC applies to Telegram/Discord/Web Chat. WhatsApp still needs Meta
  // verification, so no page may promise a self-serve WhatsApp connection.
  assert.match(cac.colly, /CAC/);
  assert.match(cac.colly, /waitlist/i);

  const json = `${JSON.stringify(COMPARISON_FEATURES)} ${COMPETITOR_DISCLAIMER}`;
  assert.equal(
    json.includes("WhatsApp Business API"),
    false,
    "retired claim: Colly never had the WhatsApp Business API",
  );
});

test("the comparison page publishes both products as one ItemList", () => {
  type Product = {
    name: string;
    additionalProperty: Array<{ name: string; value: string }>;
  };

  for (const competitor of COMPETITORS) {
    const node = comparisonJsonLd(competitor);
    assert.equal(node["@type"], "WebPage");
    assert.equal(node.description, comparisonAnswer(competitor));

    const list = node.mainEntity as {
      "@type": string;
      numberOfItems: number;
      itemListElement: Array<{ position: number; item: Product }>;
    };
    assert.equal(list["@type"], "ItemList");
    assert.equal(list.numberOfItems, 2);
    assert.equal(list.itemListElement.length, 2);

    const [colly, other] = list.itemListElement;
    assert.equal(colly.position, 1);
    assert.equal(other.position, 2);
    assert.equal(other.item.name, competitor.name);

    // One property per visible table row, in table order, for both products.
    const labels = COMPARISON_FEATURES.map((feature) => feature.label);
    assert.deepEqual(colly.item.additionalProperty.map((p) => p.name), labels);
    assert.deepEqual(other.item.additionalProperty.map((p) => p.name), labels);
    assert.deepEqual(
      colly.item.additionalProperty.map((p) => p.value),
      COMPARISON_FEATURES.map((feature) => feature.colly),
    );
    assert.deepEqual(
      other.item.additionalProperty.map((p) => p.value),
      COMPARISON_FEATURES.map((feature) => competitor.values[feature.id]),
    );
  }
});

test("direct answers are 40-60 words and every question is a question", () => {
  for (const faq of MARKETING_FAQS) {
    assert.ok(
      faq.q.trim().endsWith("?"),
      `"${faq.q}" is a label, not the question a buyer asks`,
    );

    const words = wordCount(faq.a);
    assert.ok(
      words >= FAQ_ANSWER_WORDS.min && words <= FAQ_ANSWER_WORDS.max,
      `"${faq.q}" answers in ${words} words — a quotable answer needs ${FAQ_ANSWER_WORDS.min}-${FAQ_ANSWER_WORDS.max}`,
    );
  }

  assert.equal(
    new Set(MARKETING_FAQS.map((faq) => faq.q)).size,
    MARKETING_FAQS.length,
    "duplicate questions would ship duplicate schema",
  );

  for (const competitor of COMPETITORS) {
    const words = wordCount(comparisonAnswer(competitor));
    assert.ok(
      words >= FAQ_ANSWER_WORDS.min && words <= FAQ_ANSWER_WORDS.max,
      `the ${competitor.name} verdict is ${words} words — keep it quotable`,
    );
  }
});

test("one FAQPage, built from the array the component renders", () => {
  const node = faqJsonLd();
  const questions = node.mainEntity as Array<{
    "@type": string;
    name: string;
    acceptedAnswer: { "@type": string; text: string };
  }>;

  assert.equal(questions.length, MARKETING_FAQS.length);
  assert.deepEqual(
    questions.map((question) => question.name),
    MARKETING_FAQS.map((faq) => faq.q),
  );
  assert.deepEqual(
    questions.map((question) => question.acceptedAnswer.text),
    MARKETING_FAQS.map((faq) => faq.a),
  );
});

test("public/llms.txt names the entity and links the core pages", () => {
  const llms = readFileSync(
    new URL("../public/llms.txt", import.meta.url),
    "utf8",
  );

  assert.ok(llms.startsWith("# Colly AI"));
  assert.match(
    llms,
    /^> .*Nigerian software company .*AI sales assistants/m,
    "the one-line summary is what an AI crawler reads first",
  );
  assert.ok(llms.includes("[Pricing](https://colly.com.ng/pricing)"));
  assert.ok(llms.includes("[Agent Academy](https://colly.com.ng/academy)"));
  assert.match(llms, /Plans start at ₦15,000\/month/);
});

test("every country is prerendered, listed in the sitemap and public", () => {
  assert.ok(
    COUNTRIES.length >= 4,
    "the four launch countries (Nigeria, Ghana, Kenya, South Africa) must be present",
  );

  const slugs = new Set<string>();

  for (const country of COUNTRIES) {
    assert.match(
      country.slug,
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      `${country.slug} must be a URL-safe slug (it is the generateStaticParams key)`,
    );
    assert.equal(
      slugs.has(country.slug),
      false,
      `duplicate country slug ${country.slug}`,
    );
    slugs.add(country.slug);

    assert.ok(country.name.length > 0);
    assert.match(
      country.currency,
      /^[A-Z]{3}$/,
      `${country.name} needs an ISO 4217 code — the page states the currency the bank settles in, never a local price`,
    );
    assert.ok(
      country.intro.length > 60,
      `${country.name} needs real local context, not a templated sentence`,
    );

    // A country page links its own city pages, so every slug it lists must have
    // a record in `lib/locations.ts` — otherwise the page ships a dead link.
    for (const citySlug of country.cities) {
      assert.ok(
        getLocation(citySlug),
        `${country.name} links /locations/${citySlug}, which is not in LOCATIONS`,
      );
    }

    assert.deepEqual(getCountry(country.slug), country);
    assert.equal(countryPath(country.slug), `/countries/${country.slug}`);

    assert.ok(
      PUBLIC_PAGES.some((page) => page.path === countryPath(country.slug)),
      `${country.slug} is missing from PUBLIC_PAGES`,
    );
    assert.equal(isPublicRoute(countryPath(country.slug)), true);
  }

  assert.equal(getCountry("atlantis"), undefined);
});


/**
 * The two HTTP outcomes, expressed as the decisions that produce them. The
 * status is settled by the proxy *before* anything renders: a country in
 * `COUNTRIES` is public, prerendered and in the sitemap, so the request reaches
 * the page and answers 200; an unlisted slug is still let through to the app
 * (never the `/login` redirect, which a crawler reads as a soft 404) but
 * `isUnknownGeoRoute` flags it, and the proxy rewrites it to a path with no
 * route — a real 404 with the app's not-found page. Both statuses were also
 * confirmed against a production build (`npm run start`): `/countries/nigeria`
 * → 200, `/countries/atlantis` → 404.
 */
test("a known country route answers 200 and an unknown one answers 404", () => {
  // `/countries/nigeria` → 200.
  assert.equal(getCountry("nigeria")?.name, "Nigeria");
  assert.equal(isPublicRoute(countryPath("nigeria")), true);
  assert.equal(isUnknownGeoRoute(countryPath("nigeria")), false);
  assert.ok(
    PUBLIC_PAGES.some((page) => page.path === countryPath("nigeria")),
    "a country page must be prerendered and advertised in the sitemap",
  );

  // `/countries/atlantis` → 404.
  assert.equal(getCountry("atlantis"), undefined);
  assert.equal(isPublicRoute("/countries/atlantis"), true);
  assert.equal(isUnknownGeoRoute("/countries/atlantis"), true);
  assert.equal(NOT_FOUND_REWRITE_PATH, "/not-found");
  assert.equal(
    PUBLIC_PAGES.some((page) => page.path === NOT_FOUND_REWRITE_PATH),
    false,
    "the rewrite target must stay a path with no route — that is what makes the 404 real",
  );

  // Adding the country prefix must not loosen the city or competitor guards, and
  // a bare prefix is not a slug (there is no /countries index page).
  assert.equal(isUnknownGeoRoute("/locations/atlantis"), true);
  assert.equal(isUnknownGeoRoute("/vs/unknown-tool"), true);
  assert.equal(isUnknownGeoRoute("/countries"), false);
  assert.equal(isUnknownGeoRoute("/vs"), false);
});


test("a country page publishes a Country node beside the Naira offer", () => {
  const kenya = getCountry("kenya");
  assert.ok(kenya, "kenya must be in COUNTRIES");

  const nodes = countryJsonLd(kenya);
  assert.equal(nodes.length, 2);
  const [countryNode, pageNode] = nodes;

  // The entity itself: what an answer engine reads to say "available in Kenya".
  assert.equal(countryNode["@context"], "https://schema.org");
  assert.equal(countryNode["@type"], "Country");
  assert.equal(countryNode.name, kenya.name);
  assert.equal(countryNode.description, countryDescription(kenya));
  assert.ok(String(countryNode.url).endsWith("/countries/kenya"));

  // The page node: the same shell a city page uses, with the country cited by id.
  assert.equal(pageNode["@type"], "WebPage");
  assert.equal(pageNode.name, "AI Sales Assistant for Businesses in Kenya");
  assert.equal(pageNode.description, countryDescription(kenya));

  const service = pageNode.mainEntity as {
    "@type": string;
    areaServed: { "@type": string; "@id": string; name: string };
    offers: { "@type": string; price: string; priceCurrency: string };
  };
  assert.equal(service["@type"], "Service");
  assert.equal(service.areaServed["@type"], "Country");
  assert.equal(service.areaServed.name, "Kenya");
  assert.equal(
    service.areaServed["@id"],
    countryNode["@id"],
    "the service must cite the Country node instead of repeating the name",
  );
  assert.equal(service.offers.price, String(PLANS.green.monthly));
  assert.equal(service.offers.priceCurrency, "NGN");

  const breadcrumb = pageNode.breadcrumb as {
    itemListElement: Array<{ position: number; name: string }>;
  };
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.name),
    ["Home", "Kenya"],
  );

  // One price list everywhere: the country copy quotes the tier price from
  // `lib/plans.ts` and never invents a local one.
  assert.ok(countryDescription(kenya).includes(formatNaira(PLANS.green.monthly)));

  // The page and the schema share one canonical URL.
  const metadata = pageMetadata({
    title: "AI Sales Assistant in Kenya",
    description: countryDescription(kenya),
    path: countryPath("kenya"),
  });
  assert.ok(
    String(metadata.alternates?.canonical).endsWith("/countries/kenya"),
    "the canonical must be the country URL, not /",
  );
});

