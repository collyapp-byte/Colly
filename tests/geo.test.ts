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
  COMPETITORS_HUB_PATH,
  COMPETITOR_DISCLAIMER,
  COMPETITOR_REVIEWED,
  comparisonAnswer,
  competitorPath,
  getCompetitor,
} from "../lib/competitors";
import { COUNTRIES, countryPath, getCountry } from "../lib/countries";
import { formatNaira } from "../lib/format";
import {
  LOCATIONS,
  LOCATIONS_HUB_PATH,
  getLocation,
  locationPath,
} from "../lib/locations";
import { FAQ_ANSWER_WORDS, MARKETING_FAQS } from "../lib/marketing-faq";
import { PLANS, REPLY_CREDIT_COSTS } from "../lib/plans";
import {
  NOT_FOUND_REWRITE_PATH,
  isPublicRoute,
  isUnknownGeoRoute,
} from "../lib/public-routes";
import {
  comparisonHubDescription,
  comparisonHubJsonLd,
  comparisonJsonLd,
  countryDescription,
  countryJsonLd,
  faqJsonLd,
  locationDescription,
  locationJsonLd,
  pageMetadata,
  placesHubDescription,
  placesHubJsonLd,
} from "../lib/seo";
import { PUBLIC_PAGES, SITE_URL, absoluteUrl } from "../lib/site";

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
  assert.deepEqual([...ids].sort(), [
    "ai",
    "cac",
    "channels",
    "jiji",
    "pidgin",
    "pricing",
  ]);
  // The advantages Colly leads with open the table, in the order the hub prose
  // lists them: paperwork, money, catalogue, language.
  assert.deepEqual(ids.slice(0, 4), ["cac", "pricing", "jiji", "pidgin"]);
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

/**
 * The Nigerian vendors that own the "AI chatbot for Nigerian business" answer
 * boxes are the queries this surface exists to win, so they are pinned by slug
 * here rather than by count: dropping one of them changes routing (sitemap,
 * public allowlist, 404 rewrite), which has to be a deliberate edit.
 */
test("the Nigerian AI tools buyers search for each have a comparison page", () => {
  const targeted = ["zella-ai", "loop56", "buvvo-ai", "accessplanet", "wabot"];

  for (const slug of targeted) {
    const competitor = getCompetitor(slug);
    assert.ok(competitor, `/vs/${slug} would 404 — no record in COMPETITORS`);

    // Every field the hub card and the comparison table render must be filled in.
    assert.ok(competitor.name.trim().length > 0, `${slug} needs a display name`);
    for (const [field, value] of Object.entries({
      summary: competitor.summary,
      bestFor: competitor.bestFor,
      pricingModel: competitor.pricingModel,
      collyEdge: competitor.collyEdge,
    })) {
      assert.ok(value.trim().length > 20, `${slug}.${field} is too thin to rank`);
    }

    assert.equal(competitorPath(slug), `/vs/${slug}`);
    assert.equal(isPublicRoute(`/vs/${slug}`), true);
    assert.equal(
      isUnknownGeoRoute(`/vs/${slug}`),
      false,
      `${slug} resolves, so it must never be rewritten to the 404 page`,
    );
    assert.equal(
      isUnknownGeoRoute(`/vs/${slug}-unknown`),
      true,
      "only the exact slug resolves; a near-miss is still a 404",
    );
    assert.ok(
      PUBLIC_PAGES.some((page) => page.path === `/vs/${slug}`),
      `${slug} is missing from the sitemap`,
    );
  }
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

  // A competitor may honestly be described as running on Meta's official
  // channel; the retired claim is Colly having that API, so no vendor record may
  // repeat it either.
  assert.equal(
    JSON.stringify(COMPETITORS).includes("WhatsApp Business API"),
    false,
    "the comparison copy must not imply Colly runs the WhatsApp Business API",
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
  // The two hubs are the crawl path into the programmatic pages, so the file an
  // answer engine reads first must advertise them too.
  assert.ok(llms.includes("[All locations](https://colly.com.ng/locations)"));
  assert.ok(llms.includes("[Comparisons](https://colly.com.ng/vs)"));
  // Every vendor on /vs is named here too: this is the file an answer engine
  // reads before it crawls, so a comparison it cannot see is one it will not cite.
  for (const competitor of COMPETITORS) {
    assert.ok(
      llms.includes(competitor.name),
      `${competitor.name} has a comparison page but is not named in llms.txt`,
    );
  }
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

/**
 * The two hubs are the crawl path into the programmatic pages: without them a
 * crawler only reaches a comparison or a city page from a sibling, and an
 * unknown slug is the only thing the proxy rewrites to `NOT_FOUND_REWRITE_PATH`.
 * "Returns 200" is asserted as the three conditions that produce it: the proxy
 * lets a signed-out visitor through, it does not rewrite the path to the 404
 * target, and a route file exists that exports the page and its metadata.
 */
test("the /vs and /locations hubs render instead of 404ing", () => {
  assert.equal(LOCATIONS_HUB_PATH, "/locations");
  assert.equal(COMPETITORS_HUB_PATH, "/vs");

  for (const hub of [LOCATIONS_HUB_PATH, COMPETITORS_HUB_PATH]) {
    // 200, part one: no session required, and no 404 rewrite.
    assert.equal(isPublicRoute(hub), true, `${hub} must render without a session`);
    assert.equal(
      isUnknownGeoRoute(hub),
      false,
      `${hub} is a hub, not an unknown slug — it must not be rewritten to a 404`,
    );
    assert.notEqual(hub, NOT_FOUND_REWRITE_PATH);

    // Advertised exactly once, so the sitemap and the canonicals agree.
    assert.equal(
      PUBLIC_PAGES.filter((page) => page.path === hub).length,
      1,
      `${hub} must be in PUBLIC_PAGES exactly once`,
    );

    // 200, part two: a route actually serves the path. A hub the proxy allowed
    // but no route served would still be a 404, which is the failure this test
    // exists to catch.
    const source = readFileSync(
      new URL(`../app/(marketing)${hub}/page.tsx`, import.meta.url),
      "utf8",
    );
    assert.match(source, /export default function/, `${hub} has no page component`);
    assert.match(
      source,
      /export function generateMetadata/,
      `${hub} must publish its own metadata`,
    );
  }

  // The hubs do not loosen the leaf guards: a known slug still renders and an
  // unknown one is still a real 404.
  assert.equal(isUnknownGeoRoute("/locations/lagos"), false);
  assert.equal(isUnknownGeoRoute("/locations/atlantis"), true);
  assert.equal(isUnknownGeoRoute("/vs/dmly"), false);
  assert.equal(isUnknownGeoRoute("/vs/unknown-tool"), true);
});

/**
 * The hubs' structured data: a `CollectionPage` whose ItemList is the same set
 * of URLs the cards link to. A competitor, city or country added to its data
 * module appears in the hub schema without a second edit, and the copy quotes
 * the Naira price from `lib/plans.ts` rather than typing one.
 */
test("the hubs publish an ItemList of every leaf page", () => {
  type ListItem = {
    position: number;
    item: { "@type": string; url: string };
  };
  type ItemList = {
    "@type": string;
    numberOfItems: number;
    itemListElement: ListItem[];
  };

  const comparisons = comparisonHubJsonLd();
  assert.equal(comparisons["@type"], "CollectionPage");
  assert.equal(comparisons.url, absoluteUrl(COMPETITORS_HUB_PATH));
  assert.equal(
    comparisons["@id"],
    `${absoluteUrl(COMPETITORS_HUB_PATH)}#webpage`,
  );
  assert.equal(comparisons.description, comparisonHubDescription());

  const comparisonList = comparisons.mainEntity as ItemList;
  assert.equal(comparisonList["@type"], "ItemList");
  assert.equal(comparisonList.numberOfItems, COMPETITORS.length);
  assert.deepEqual(
    comparisonList.itemListElement.map((entry) => entry.item.url),
    COMPETITORS.map((competitor) =>
      absoluteUrl(competitorPath(competitor.slug)),
    ),
  );
  assert.deepEqual(
    comparisonList.itemListElement.map((entry) => entry.position),
    COMPETITORS.map((_, index) => index + 1),
  );

  const places = placesHubJsonLd();
  assert.equal(places["@type"], "CollectionPage");
  assert.equal(places.url, absoluteUrl(LOCATIONS_HUB_PATH));
  assert.equal(places.description, placesHubDescription());

  const placesList = places.mainEntity as ItemList;
  assert.equal(placesList["@type"], "ItemList");
  assert.equal(placesList.numberOfItems, COUNTRIES.length + LOCATIONS.length);
  // Countries first (the parent level), then the cities inside them.
  assert.deepEqual(
    placesList.itemListElement.map((entry) => entry.item.url),
    [
      ...COUNTRIES.map((country) => absoluteUrl(countryPath(country.slug))),
      ...LOCATIONS.map((location) => absoluteUrl(locationPath(location.slug))),
    ],
  );
  assert.deepEqual(
    placesList.itemListElement.map((entry) => entry.item["@type"]),
    [...COUNTRIES.map(() => "Country"), ...LOCATIONS.map(() => "City")],
  );

  // Both hubs hang off the homepage's website node, and the copy they publish
  // quotes the live price and the dated review instead of typing either.
  for (const node of [comparisons, places]) {
    assert.equal((node.isPartOf as { "@id": string })["@id"], `${SITE_URL}/#website`);
    assert.equal((node.about as { "@id": string })["@id"], `${SITE_URL}/#organization`);
  }
  assert.ok(placesHubDescription().includes(formatNaira(PLANS.green.monthly)));
  assert.ok(
    comparisonHubDescription().includes(formatNaira(PLANS.green.monthly)),
  );
  assert.ok(comparisonHubDescription().includes(COMPETITOR_REVIEWED));
});



