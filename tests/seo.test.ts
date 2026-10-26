import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { HomepageJsonLd, JsonLd } from "../components/seo/json-ld";
import {
  ACADEMY_COURSES,
  ACADEMY_LESSON_COUNT,
  FINAL_EXAM_QUESTION_COUNT,
} from "../lib/academy-catalogue";
import { MARKETING_FAQS } from "../lib/marketing-faq";
import { FREE_PLAN_LIMITS, PLANS } from "../lib/plans";
import {
  academyJsonLd,
  faqJsonLd,
  organizationJsonLd,
  pageMetadata,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "../lib/seo";
import { isPublicRoute } from "../lib/public-routes";
import {
  OG_IMAGE,
  PRIVATE_PATHS,
  PUBLIC_PAGES,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "../lib/site";

type ContentCourse = {
  slug: string;
  title: string;
  description: string;
  order: number;
  lessons: unknown[];
};

const require = createRequire(import.meta.url);
const academyContent = require("../prisma/academy-content.cjs") as {
  AGENT_COURSES: ContentCourse[];
  FINAL_EXAM_QUESTIONS: unknown[];
};

/**
 * True when a `robots.txt` rule keeps a crawler out of `path`. A rule without a
 * trailing slash also covers everything beneath it (`/dashboard` hides
 * `/dashboard/settings`), which is how Google reads the file.
 */
function isBlockedBy(path: string, rules: readonly string[]): boolean {
  return rules.some((rule) => {
    const prefix = rule.endsWith("/") ? rule : `${rule}/`;
    return path === rule || path.startsWith(prefix);
  });
}

function robotsRules() {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const rule = rules[0];
  assert.ok(rule, "robots.txt must declare at least one rule group");

  const asList = (value: string | string[] | undefined): string[] =>
    value === undefined ? [] : Array.isArray(value) ? value : [value];

  return {
    result,
    allow: asList(rule.allow),
    disallow: asList(rule.disallow),
  };
}

test("site URLs are absolute, https and free of a trailing slash", () => {
  assert.match(SITE_URL, /^https?:\/\/[^/]+$/);
  assert.equal(SITE_URL.endsWith("/"), false);

  assert.equal(absoluteUrl("/"), SITE_URL);
  assert.equal(absoluteUrl(""), SITE_URL);
  assert.equal(absoluteUrl("/pricing"), `${SITE_URL}/pricing`);
  assert.equal(absoluteUrl("pricing"), `${SITE_URL}/pricing`);
  assert.equal(absoluteUrl("/"), absoluteUrl("/"), "deterministic");
});

test("the sitemap lists every public page exactly once", () => {
  const entries = sitemap();

  assert.equal(entries.length, PUBLIC_PAGES.length);
  assert.deepEqual(
    entries.map((entry) => entry.url),
    PUBLIC_PAGES.map((page) => absoluteUrl(page.path)),
  );

  const urls = entries.map((entry) => entry.url);
  assert.equal(new Set(urls).size, urls.length, "no duplicate URLs");
  assert.ok(urls.includes(absoluteUrl("/")));
  assert.ok(urls.includes(absoluteUrl("/pricing")));
  assert.ok(urls.includes(absoluteUrl("/academy")));

  for (const entry of entries) {
    assert.ok(entry.url.startsWith(SITE_URL), `${entry.url} must be absolute`);
    assert.ok(entry.lastModified instanceof Date);
    assert.ok((entry.priority ?? 0) > 0 && (entry.priority ?? 0) <= 1);
  }

  // Priority must never increase as the list goes on: the first entry is the
  // one crawlers should fetch first.
  const priorities = entries.map((entry) => entry.priority ?? 0);
  assert.deepEqual(priorities, [...priorities].sort((a, b) => b - a));
});

test("robots.txt allows the site, hides the app and points at the sitemap", () => {
  const { result, allow, disallow } = robotsRules();

  assert.ok(allow.includes("/"), "the public site stays crawlable");
  assert.ok(disallow.includes("/api/"), "no API routes");
  assert.ok(disallow.includes("/dashboard"), "no dashboard");
  assert.ok(disallow.includes("/settings"), "no settings pages");
  assert.ok(disallow.includes("/chat/"), "no per-business chat widgets");
  assert.ok(disallow.includes("/agents/"), "no agent area");
  assert.equal(result.sitemap, `${SITE_URL}/sitemap.xml`);

  for (const path of PRIVATE_PATHS) {
    assert.ok(disallow.includes(path), `robots.txt must disallow ${path}`);
  }
});

test("robots.txt never hides a page that is in the sitemap", () => {
  const { disallow } = robotsRules();

  for (const page of PUBLIC_PAGES) {
    assert.equal(
      isBlockedBy(page.path, disallow),
      false,
      `${page.path} is in the sitemap but blocked by robots.txt`,
    );
  }
});
test("every sitemap URL is reachable without a session", () => {
  // The proxy bounces signed-out visitors to /login, so a page listed in the
  // sitemap but gated there is invisible to Googlebot however good its metadata
  // is. `lib/public-routes.ts` derives its marketing/legal entries from
  // PUBLIC_PAGES; this test pins that behaviour instead of the implementation.
  for (const page of PUBLIC_PAGES) {
    assert.equal(
      isPublicRoute(page.path),
      true,
      `${page.path} is in the sitemap but the proxy would redirect it to /login`,
    );
  }

  // Nested session-free routes stay open: the widget is embedded on customer
  // sites and a certificate link must open without an account.
  assert.equal(isPublicRoute("/chat/business-1"), true);
  assert.equal(isPublicRoute("/verify/AGT-0001"), true);

  // The signed-in app, the agent area and the auth screens keep redirecting
  // (`/login` is handled by the auth branch, not as a public page).
  assert.equal(isPublicRoute("/dashboard"), false);
  assert.equal(isPublicRoute("/products"), false);
  assert.equal(isPublicRoute("/agents"), false);
  assert.equal(isPublicRoute("/login"), false);
});



test("the software application schema prices every tier from lib/plans.ts", () => {
  const monthly = Object.values(PLANS).map((plan) => plan.monthly);
  const node = softwareApplicationJsonLd();

  assert.equal(node["@context"], "https://schema.org");
  assert.equal(node["@type"], "SoftwareApplication");
  assert.equal(node.name, SITE_NAME);
  assert.equal(node.url, SITE_URL);
  assert.equal(node.applicationCategory, "BusinessApplication");
  assert.equal(node.isAccessibleForFree, true, "the Free tier must stay true");
  // `isAccessibleForFree` promises a usable free tier: the monthly Free grant.
  assert.ok(FREE_PLAN_LIMITS.credits > 0);

  const area = node.areaServed as { "@type"?: string; name?: string };
  assert.equal(area["@type"], "Country");
  assert.equal(area.name, "Nigeria");

  const offers = node.offers as Record<string, unknown>;
  assert.equal(offers["@type"], "AggregateOffer");
  assert.equal(offers.priceCurrency, "NGN");
  assert.equal(offers.lowPrice, String(Math.min(...monthly)));
  assert.equal(offers.highPrice, String(Math.max(...monthly)));
  assert.equal(offers.offerCount, String(monthly.length));
  assert.equal(offers.lowPrice, "15000");
  assert.equal(offers.highPrice, "50000");
});

test("the pricing page schema itemises one offer per paid tier", () => {
  const node = softwareApplicationJsonLd({ itemisedOffers: true });
  const offers = node.offers as Array<Record<string, unknown>>;

  assert.ok(Array.isArray(offers));
  assert.deepEqual(
    offers.map((offer) => offer.price),
    Object.values(PLANS).map((plan) => String(plan.monthly)),
  );
  for (const offer of offers) {
    assert.equal(offer["@type"], "Offer");
    assert.equal(offer.priceCurrency, "NGN");
    assert.equal(offer.url, absoluteUrl("/pricing"));
  }
});


test("organization, website and product nodes share stable @ids", () => {
  const org = organizationJsonLd();
  const site = websiteJsonLd();
  const app = softwareApplicationJsonLd();

  assert.equal(org["@context"], "https://schema.org");
  assert.equal(org["@type"], "Organization");
  assert.equal(org.name, "Colly Nigeria");
  assert.equal(org.alternateName, "Colly");
  assert.equal(org.url, SITE_URL);
  assert.ok(String(org["@id"]).endsWith("#organization"));

  const logo = org.logo as { url: string };
  assert.equal(logo.url, absoluteUrl("/logo.png"), "logo must be absolute");

  assert.equal(site["@type"], "WebSite");
  assert.equal(site.inLanguage, "en-NG");
  assert.equal(
    (site.publisher as { "@id": string })["@id"],
    org["@id"],
    "the website points at the same publisher node",
  );
  assert.equal((app.publisher as { "@id": string })["@id"], org["@id"]);
});

test("structured data invents no ratings or reviews", () => {
  const nodes = [
    organizationJsonLd(),
    websiteJsonLd(),
    softwareApplicationJsonLd(),
    softwareApplicationJsonLd({ itemisedOffers: true }),
    academyJsonLd(),
    faqJsonLd(),
  ];

  for (const node of nodes) {
    const json = JSON.stringify(node);
    assert.equal(json.includes("aggregateRating"), false, "no fake ratings");
    assert.equal(json.includes('"review"'), false, "no fake reviews");
  }
});

test("the FAQPage schema mirrors the rendered FAQ list", () => {
  const node = faqJsonLd();
  const entities = node.mainEntity as Array<{
    "@type": string;
    name: string;
    acceptedAnswer: { "@type": string; text: string };
  }>;

  assert.equal(entities.length, MARKETING_FAQS.length);
  entities.forEach((entity, index) => {
    assert.equal(entity["@type"], "Question");
    assert.equal(entity.name, MARKETING_FAQS[index].q);
    assert.equal(entity.acceptedAnswer.text, MARKETING_FAQS[index].a);
  });

  assert.equal(
    JSON.stringify(node).includes("WhatsApp Business API"),
    false,
    "retired claims must not reach the schema",
  );
});

test("the homepage ships one document with the product and the FAQ answers", () => {
  // The landing page renders `<HomepageJsonLd />`, which takes no props, so the
  // nodes below are the only thing it can emit: prices cannot drift from
  // lib/plans.ts and answers cannot drift from lib/marketing-faq.ts.
  const element = HomepageJsonLd() as unknown as {
    props: { data: Array<Record<string, unknown>> };
  };
  const document = element.props.data;

  assert.deepEqual(
    document.map((node) => node["@type"]),
    ["SoftwareApplication", "FAQPage"],
    "the product answers first, then the FAQ rendered on the page",
  );

  const [app, faq] = document;

  assert.equal(app.applicationCategory, "BusinessApplication");
  assert.ok(String(app.operatingSystem).includes("Web"));
  // "Colly AI" is the phrase buyers ask AI engines about, so the product must
  // be quotable by that name even though its `name` is the legal-style one.
  const aliases = [app.name, app.alternateName].flat();
  assert.ok(aliases.includes("Colly AI"));

  // Green, Blue and Black are all priced inside the document.
  const offers = app.offers as {
    "@type": string;
    offers: Array<Record<string, unknown>>;
  };
  assert.equal(offers["@type"], "AggregateOffer");
  assert.deepEqual(
    offers.offers.map((offer) => offer.price),
    Object.values(PLANS).map((plan) => String(plan.monthly)),
  );
  assert.deepEqual(offers.offers.map((offer) => offer.price), [
    "15000",
    "25000",
    "50000",
  ]);

  // The FAQ node is the accordion, verbatim — not a second copy of the copy.
  const entities = faq.mainEntity as Array<{
    name: string;
    acceptedAnswer: { text: string };
  }>;
  assert.deepEqual(
    entities.map((entity) => entity.name),
    MARKETING_FAQS.map((item) => item.q),
  );
  assert.deepEqual(
    entities.map((entity) => entity.acceptedAnswer.text),
    MARKETING_FAQS.map((item) => item.a),
  );
});

test("the academy ItemList wraps all four courses", () => {
  const node = academyJsonLd();
  const items = node.itemListElement as Array<{
    position: number;
    item: { "@type": string; name: string; provider: { "@id": string } };
  }>;

  assert.equal(node["@type"], "ItemList");
  assert.equal(items.length, ACADEMY_COURSES.length);
  items.forEach((listItem, index) => {
    assert.equal(listItem.position, index + 1);
    assert.equal(listItem.item["@type"], "Course");
    assert.equal(listItem.item.name, ACADEMY_COURSES[index].title);
    assert.equal(
      listItem.item.provider["@id"],
      organizationJsonLd()["@id"],
      "courses are offered by the same organisation",
    );
  });
});


test("the public academy catalogue matches prisma/academy-content.cjs", () => {
  const courses = academyContent.AGENT_COURSES;

  assert.equal(ACADEMY_COURSES.length, courses.length);
  assert.equal(
    ACADEMY_LESSON_COUNT,
    courses.reduce((total, course) => total + course.lessons.length, 0),
  );
  assert.equal(FINAL_EXAM_QUESTION_COUNT, academyContent.FINAL_EXAM_QUESTIONS.length);

  ACADEMY_COURSES.forEach((course, index) => {
    const source = courses[index];
    assert.equal(course.slug, source.slug);
    assert.equal(course.title, source.title);
    assert.equal(
      course.summary,
      source.description.replace(/\s+/g, " ").trim(),
      `${course.slug} summary drifted from the seeded content`,
    );
    assert.equal(course.lessonCount, source.lessons.length);
  });
});

test("page metadata is self-referential and complete", () => {
  const meta = pageMetadata({
    title: "Pricing",
    description: "Plans and credits.",
    path: "/pricing",
  });

  assert.equal(meta.title, "Pricing");
  assert.equal(meta.alternates?.canonical, absoluteUrl("/pricing"));

  const openGraph = meta.openGraph as unknown as {
    url?: string;
    siteName?: string;
    locale?: string;
    images?: Array<{ url: string; width?: number; height?: number }>;
  };
  assert.equal(openGraph.url, absoluteUrl("/pricing"));
  assert.equal(openGraph.siteName, SITE_NAME);
  assert.equal(openGraph.locale, "en_NG");
  assert.equal(openGraph.images?.[0]?.url, absoluteUrl("/og-image.png"));
  assert.equal(openGraph.images?.[0]?.width, OG_IMAGE.width);
  assert.equal(openGraph.images?.[0]?.height, OG_IMAGE.height);

  const twitter = meta.twitter as unknown as {
    card?: string;
    images?: Array<{ url: string | URL; alt?: string }>;
  };
  assert.equal(twitter.card, "summary_large_image");
  assert.equal(twitter.images?.[0]?.url, absoluteUrl("/og-image.png"));
  assert.equal(
    twitter.images?.[0]?.alt,
    OG_IMAGE.alt,
    "twitter:image needs alt text for screen readers",
  );

  assert.equal(meta.robots, undefined, "public pages stay indexable");
});

/**
 * The declared card size is only useful if it describes the file that ships.
 * Facebook's Sharing Debugger rejects a mismatch and Twitter lays the card out
 * from these numbers, so read the PNG header (IHDR width/height are big-endian
 * uint32 at byte 16 and 20) and compare.
 */
test("the social card exists and the declared size matches the file", () => {
  const png = readFileSync(new URL("../public/og-image.png", import.meta.url));

  assert.equal(
    png.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    "og-image.png must stay a PNG (OG_IMAGE.type says image/png)",
  );
  assert.equal(png.readUInt32BE(16), OG_IMAGE.width, "declared card width is stale");
  assert.equal(png.readUInt32BE(20), OG_IMAGE.height, "declared card height is stale");

  const ratio = OG_IMAGE.width / OG_IMAGE.height;
  assert.ok(
    ratio < 3,
    `a ${OG_IMAGE.width}×${OG_IMAGE.height} card is wider than the 3:1 Open Graph limit`,
  );
});

test("private pages opt out and the home title skips the brand template", () => {
  const chat = pageMetadata({
    title: "Chat",
    description: "Private widget.",
    path: "/chat/biz-1",
    noIndex: true,
  });
  assert.deepEqual(chat.robots, { index: false, follow: false });

  const home = pageMetadata({
    title: "Colly | AI Sales & Customer Service Assistant",
    description: "Home.",
    path: "/",
    absoluteTitle: true,
  });
  assert.deepEqual(home.title, {
    absolute: "Colly | AI Sales & Customer Service Assistant",
  });
});

test("JSON-LD escapes < so a product name cannot close the script tag", () => {
  const element = JsonLd({
    data: { "@type": "Thing", name: "</script><script>alert(1)</script>" },
  }) as unknown as {
    props: { dangerouslySetInnerHTML?: { __html: string } };
  };

  const html = element.props.dangerouslySetInnerHTML?.__html ?? "";
  assert.equal(html.includes("</script>"), false);
  assert.ok(html.includes("\\u003c/script>"), "the < is emitted as an escape");
  assert.match(html, /"@type":"Thing"/);
});
