import test from "node:test";
import assert from "node:assert/strict";

import {
  JIJI_ADVERT_API_PATHS,
  JIJI_DEFAULT_HOST,
  JIJI_INVALID_TARGET_MESSAGE,
  JIJI_SOURCE,
  JIJI_UNREACHABLE_MESSAGE,
  MOCK_EXTERNAL_ID_PREFIX,
  advertGuid,
  advertHrefsFromHtml,
  advertUserId,
  extractJijiListingGuid,
  extractJijiUsername,
  fetchSellerListings,
  firstString,
  isJijiUserId,
  isLastJijiPage,
  jijiAdvertUrl,
  jijiListingUrl,
  jijiSellerPageUrl,
  listingGuidFromPath,
  looksLikeJijiGuid,
  mapListing,
  mockImportEnabled,
  normalizeName,
  pageJsonBlocks,
  parseJijiTarget,
  payloadIsTrusted,
  readAdverts,
  readJijiPageIdentity,
  readListCount,
  sellerIdsFromHtml,
} from "../lib/jiji";

/**
 * The Jiji importer has one rule above all others: a tenant's catalogue only
 * ever receives listings that came from that tenant's shop.
 *
 * Two bugs live behind that rule, and both are locked here.
 *
 * 1. The importer used to invent products. With its scraper key unset it
 *    returned three hardcoded fixtures (a Samsung Galaxy A15, a Hisense TV and a
 *    Nexus AC) with picsum.photos photos, and they were inserted as real
 *    products the AI then quoted. Now the catalogue is read directly from Jiji's
 *    own listing endpoint, and the fixtures are reachable only through the
 *    explicit, non-production `JIJI_MOCK_IMPORT=1` opt-in.
 *
 * 2. The endpoint does not reject a seller id it cannot use: it ignores it and
 *    answers with the whole marketplace (`count` in the millions). One paste of a
 *    profile URL would therefore import 20 strangers' adverts per page, so every
 *    payload is checked (`payloadIsTrusted`) before a route may write, and a
 *    payload that is not JSON or does not match the seller is an error, never an
 *    empty shop.
 */

/** Runs `fn` with a temporary env, restored even when the assertion throws. */
async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const key of Object.keys(values)) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

/** A payload shaped like the real endpoint's, for the given sellers. */
function envelope(userIds: string[], count = userIds.length): unknown {
  return {
    status: 200,
    status_code: 0,
    adverts_list: {
      count,
      adverts: userIds.map((userId, index) => ({
        id: 900_100 + index,
        guid: `hdOZhLA7u0r6u5lqZ1gOJhn${index}`,
        title: `iPhone 11 64GB ${index}`,
        price_obj: { value: 250_000, view: "₦250,000" },
        user_id: userId,
        status: "active",
      })),
    },
  };
}

test("a payload is only trusted when it belongs to the seller we asked for", () => {
  // The seller's own catalogue.
  assert.equal(payloadIsTrusted(envelope(["17389808", "17389808"]), "17389808"), true);

  // A shop that exists but has nothing live: an answer, not a failure.
  assert.equal(payloadIsTrusted({ adverts_list: { count: 0, adverts: [] } }, "17389808"), true);

  // One foreign advert is enough to refuse the page.
  assert.equal(payloadIsTrusted(envelope(["17389808", "4242"]), "17389808"), false);

  // The marketplace answering an ignored `user_id` (count ~2.4M).
  assert.equal(
    payloadIsTrusted(envelope(["1", "2", "3"], 2_400_000), "17389808"),
    false,
  );

  // Jiji's no-JSON error shape.
  assert.equal(
    payloadIsTrusted({ status: "error", status_code: 500, url: "/api_web/v1/listing" }, "17389808"),
    false,
  );

  // Not a payload at all.
  assert.equal(payloadIsTrusted(null, "17389808"), false);
  assert.equal(payloadIsTrusted("<html>blocked</html>", "17389808"), false);
});

test("the advert array and its count are read from the real envelope", () => {
  const payload = envelope(["17389808", "17389808"], 2);
  assert.equal(readAdverts(payload).length, 2);
  assert.equal(readListCount(payload), 2);

  // Tolerated legacy shapes; the endpoint is undocumented.
  assert.equal(readAdverts([{ id: 1 }]).length, 1);
  assert.equal(readAdverts({ data: { listings: [{ id: 1 }, { id: 2 }] } }).length, 2);
  assert.equal(readAdverts({ status: "error" }).length, 0);

  assert.equal(readListCount({ adverts_list: { count: "1,234" } }), 1234);
  assert.equal(readListCount({ status: "error" }), null);
});

test("every advert is attributed to its seller", () => {
  assert.equal(advertUserId({ user_id: 17389808 }), "17389808");
  assert.equal(advertUserId({ user_id: "17389808" }), "17389808");
  assert.equal(advertUserId({ seller: { id: 4200 } }), "4200");
  assert.equal(advertUserId({ user_name: "kevin" }), null);
  assert.equal(advertUserId(null), null);

  assert.equal(advertGuid({ guid: "hdOZhLA7u0r6u5lqZ1gOJhn0" }), "hdOZhLA7u0r6u5lqZ1gOJhn0");
  assert.equal(advertGuid({ id: 12 }), null);
});

test("a 404 ends the page loop", () => {
  assert.equal(isLastJijiPage(404), true);
  assert.equal(isLastJijiPage(410), true);
  assert.equal(isLastJijiPage(200), false);
  assert.equal(isLastJijiPage(500), false);
  assert.equal(isLastJijiPage(403), false);
});

test("listing URLs are built with only the parameters Jiji honours", () => {
  assert.equal(
    jijiListingUrl({ user_id: "17389808", page: 2, query: undefined, region_slug: null }),
    "https://jiji.ng/api_web/v1/listing?user_id=17389808&page=2",
  );
  assert.equal(
    jijiListingUrl({ query: "iphone 11", region_slug: "lagos", page: "" }),
    "https://jiji.ng/api_web/v1/listing?query=iphone+11&region_slug=lagos",
  );
});

test("a product link yields its advert guid, title words and region", () => {
  const url =
    "https://jiji.ng/gwarinpa/mobile-phones/iphone-se-2020-64gb-black-hdOZhLA7u0r6u5lqZ1gOJhn0.html";

  assert.equal(extractJijiListingGuid(url), "hdOZhLA7u0r6u5lqZ1gOJhn0");
  // The guid survives a query string and a trailing slash.
  assert.equal(
    extractJijiListingGuid(`${url}?page=2`),
    "hdOZhLA7u0r6u5lqZ1gOJhn0",
  );

  assert.deepEqual(parseJijiTarget(url), {
    kind: "listing",
    guid: "hdOZhLA7u0r6u5lqZ1gOJhn0",
    query: "iphone se 2020 64gb black",
    regionSlug: "gwarinpa",
    url,
    host: JIJI_DEFAULT_HOST,
  });

  // Nothing advert-shaped here.
  assert.equal(extractJijiListingGuid("https://jiji.ng/c/mobile-phones"), null);
  assert.equal(extractJijiListingGuid("https://jiji.ng/kevin-enterprise"), null);
  assert.equal(extractJijiListingGuid("https://example.com/x-abc.html"), null);
});

test("a product link works without the .html suffix", () => {
  // Current Jiji pages: /<region>/<category>/<title>-<guid>, no suffix.
  const dashed =
    "https://jiji.ng/lagos/computers-and-laptops/hp-elitebook-840-g5-hmJzdAFmEMmZMY8Ol8ENvVAy";

  assert.equal(extractJijiListingGuid(dashed), "hmJzdAFmEMmZMY8Ol8ENvVAy");
  assert.deepEqual(parseJijiTarget(dashed), {
    kind: "listing",
    guid: "hmJzdAFmEMmZMY8Ol8ENvVAy",
    query: "hp elitebook 840 g5",
    regionSlug: "lagos",
    url: dashed,
    host: JIJI_DEFAULT_HOST,
  });

  // A bare hash as the last segment is the same advert.
  assert.equal(
    extractJijiListingGuid("https://jiji.ng/lagos/phones/hmJzdAFmEMmZMY8Ol8ENvVAy"),
    "hmJzdAFmEMmZMY8Ol8ENvVAy",
  );
  assert.equal(
    parseJijiTarget("https://jiji.ng/lagos/phones/hmJzdAFmEMmZMY8Ol8ENvVAy")?.kind,
    "listing",
  );

  // Listing pages without a region prefix are read too.
  assert.equal(
    extractJijiListingGuid(
      "https://jiji.ng/computers-and-laptops/hp-elitebook-hmJzdAFmEMmZMY8Ol8ENvVAy",
    ),
    "hmJzdAFmEMmZMY8Ol8ENvVAy",
  );

  // A trailing slash or a query string changes nothing.
  assert.equal(
    extractJijiListingGuid(`${dashed}/?page=2`),
    "hmJzdAFmEMmZMY8Ol8ENvVAy",
  );
  assert.equal(listingGuidFromPath("/lagos/phones/hmJzdAFmEMmZMY8Ol8ENvVAy"), "hmJzdAFmEMmZMY8Ol8ENvVAy");

  // Category, search, seller and `c/` pages stay pages: a category word is not
  // a hash, so none of them can be imported as an advert.
  for (const url of [
    "https://jiji.ng/lagos/computers-and-laptops",
    "https://jiji.ng/lagos/accessories",
    "https://jiji.ng/c/computers-and-laptops",
    "https://jiji.ng/lagos/computers-and-laptops/hp-elitebook-840-g5",
    "https://jiji.ng/sellerpage-hmJzdAFmEMmZMY8Ol8ENvVAy",
    "https://jiji.ng/kevin-enterprise",
  ]) {
    assert.equal(extractJijiListingGuid(url), null, url);
  }

  // The hash rule itself: long, mixed, and carrying a digit.
  assert.equal(looksLikeJijiGuid("hmJzdAFmEMmZMY8Ol8ENvVAy"), true);
  assert.equal(looksLikeJijiGuid("hdOZhLA7u0r6u5lqZ1gOJhn0"), true);
  assert.equal(looksLikeJijiGuid("accessories"), false);
  assert.equal(looksLikeJijiGuid("laptops"), false);
  assert.equal(looksLikeJijiGuid("13pro"), false);
});

test("seller ids are read out of a product page's metadata", () => {
  const guid = "hmJzdAFmEMmZMY8Ol8ENvVAy";
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "HP EliteBook 840 G5",
    offers: {
      "@type": "Offer",
      price: "250000",
      seller: { "@type": "Person", name: "Kevin", id: 17389808 },
    },
  });
  const html = [
    `<link rel="canonical" href="https://jiji.ng/lagos/computers-and-laptops/hp-elitebook-${guid}">`,
    '<meta property="og:type" content="product">',
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join("\n");

  const identity = readJijiPageIdentity(html);
  assert.equal(identity.advertGuid, guid);
  assert.equal(identity.isProductPage, true);
  assert.deepEqual(sellerIdsFromHtml(html, { advertGuid: guid }), ["17389808"]);

  // The client state says the same thing when there is no JSON-LD.
  const state = [
    `<meta property="og:url" content="https://jiji.ng/gwarinpa/phones/iphone-11-${guid}.html">`,
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { advert: { guid, user_id: "17389808" } },
    })}</script>`,
  ].join("");
  assert.deepEqual(sellerIdsFromHtml(state), ["17389808"]);

  // A page that turns out to be a different advert yields nothing at all.
  assert.deepEqual(
    sellerIdsFromHtml(html, { advertGuid: "TOTALLYdifferentGU1dxyz" }),
    [],
  );

  // A bare `user_id` only counts on a page that is about ONE advert: a grid
  // names dozens of sellers, and the first one is not this shop's.
  const grid = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    adverts: [{ user_id: "11111111" }, { user_id: "22222222" }],
  })}</script>`;
  assert.deepEqual(sellerIdsFromHtml(grid), []);

  // A non-numeric id is not a seller id (Jiji's numeric id is the only shape
  // the listing endpoint filters on).
  const nonNumeric = `<script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    seller: { id: "kevin" },
  })}</script>`;
  assert.deepEqual(sellerIdsFromHtml(nonNumeric), []);

  // JSON-LD and client state are both optional, and junk is skipped.
  assert.deepEqual(pageJsonBlocks("<div>no scripts</div>"), []);
  assert.deepEqual(pageJsonBlocks('<script type="text/plain">{"user_id":1}</script>'), []);
});

test("a GUID seller page resolves through its own metadata", () => {
  const guid = "ffkTwbRgL9mtIqdSX4svUuQx";
  const target = parseJijiTarget(`https://jiji.ng/sellerpage-${guid}`);

  assert.equal(target?.kind, "shop");
  assert.equal(target?.kind === "shop" ? target.sellerGuid : "missing", guid);

  const html = [
    `<link rel="canonical" href="https://jiji.ng/sellerpage-${guid}">`,
    `<script>window.__INITIAL_STATE__ = ${JSON.stringify({
      seller: { id: "17389808", name: "Kevin" },
    })};</script>`,
    '<a href="https://jiji.ng/sellerpage-17389808">About this seller</a>',
  ].join("\n");

  assert.equal(readJijiPageIdentity(html).sellerGuid, guid);
  assert.deepEqual(sellerIdsFromHtml(html, { sellerGuid: guid }), ["17389808"]);

  // A page naming a different seller page cannot be used for this link.
  assert.deepEqual(
    sellerIdsFromHtml(html, { sellerGuid: "w6HRdifferentGu1dvalue123" }),
    [],
  );

  // With no id in the markup, a `/sellerpage-<id>` link is the last resort.
  const linkedOnly = [
    `<link rel="canonical" href="https://jiji.ng/sellerpage-${guid}">`,
    '<a href="https://jiji.ng/sellerpage-17389808">Shop</a>',
  ].join("");
  assert.deepEqual(sellerIdsFromHtml(linkedOnly, { sellerGuid: guid }), [
    "17389808",
  ]);
});

test("endpoints follow the link's own country domain", () => {
  assert.equal(
    jijiListingUrl({ user_id: "17389808", page: 2 }, "jiji.com.gh"),
    "https://jiji.com.gh/api_web/v1/listing?user_id=17389808&page=2",
  );

  // A pasted host can never redirect the request: only jiji.* is accepted.
  assert.equal(
    jijiListingUrl({ user_id: "17389808" }, "evil.example"),
    "https://jiji.ng/api_web/v1/listing?user_id=17389808",
  );

  assert.equal(
    jijiSellerPageUrl("17389808", "jiji.co.ke"),
    "https://jiji.co.ke/sellerpage-17389808",
  );
  assert.equal(
    jijiSellerPageUrl("17389808"),
    "https://jiji.ng/sellerpage-17389808",
  );

  // The advert endpoints are tried in order, on the same country domain. The
  // live spelling is `/item`; the others are older fallbacks.
  assert.equal(JIJI_ADVERT_API_PATHS[0], "/api_web/v1/item");
  assert.equal(
    jijiAdvertUrl(
      "hmJzdAFmEMmZMY8Ol8ENvVAy",
      JIJI_ADVERT_API_PATHS[0],
      "jiji.com.gh",
    ),
    "https://jiji.com.gh/api_web/v1/item/hmJzdAFmEMmZMY8Ol8ENvVAy",
  );
  assert.equal(JIJI_ADVERT_API_PATHS.length >= 2, true);

  // A guid can never inject a path or a host.
  assert.equal(
    jijiAdvertUrl("../../etc/passwd", "/api_web/v1/adverts"),
    "https://jiji.ng/api_web/v1/adverts/..%2F..%2Fetc%2Fpasswd",
  );

  // The country domain travels with the parsed target.
  const ghana = parseJijiTarget(
    "https://jiji.com.gh/accra/mobile-phones/iphone-11-hmJzdAFmEMmZMY8Ol8ENvVAy",
  );
  assert.equal(ghana?.kind === "listing" ? ghana.host : null, "jiji.com.gh");
  assert.equal(ghana?.kind === "listing" ? ghana.regionSlug : null, "accra");

  const www = parseJijiTarget("https://www.jiji.ng/sellerpage-17389808");
  assert.equal(www?.kind === "user" ? www.host : null, "jiji.ng");
});

test("a shop page's suffix-free listing links are followed too", () => {
  const html = [
    '<a href="/lagos/computers-and-laptops/hp-elitebook-hmJzdAFmEMmZMY8Ol8ENvVAy">HP</a>',
    '<a href="/lagos/computers-and-laptops">Category</a>',
    '<a href="/sellerpage-17389808">Shop</a>',
    '<a href="//evil.example/lagos/computers-and-laptops/x-hmJzdAFmEMmZMY8Ol8ENvVAy">x</a>',
  ].join("");

  assert.deepEqual(advertHrefsFromHtml(html), [
    "/lagos/computers-and-laptops/hp-elitebook-hmJzdAFmEMmZMY8Ol8ENvVAy",
  ]);
});

test("a seller id is recognised in every form Jiji offers it", () => {
  assert.equal(isJijiUserId("17389808"), true);
  assert.equal(isJijiUserId(" 17389808 "), true);
  assert.equal(isJijiUserId("abc1234567"), false);
  assert.equal(isJijiUserId("12"), false);

  // Bare id and the two seller-page forms.
  assert.deepEqual(parseJijiTarget("17389808"), {
    kind: "user",
    userId: "17389808",
    host: JIJI_DEFAULT_HOST,
  });
  assert.deepEqual(parseJijiTarget("https://jiji.ng/sellerpage-17389808"), {
    kind: "user",
    userId: "17389808",
    host: "jiji.ng",
  });
  assert.deepEqual(
    parseJijiTarget("https://jiji.ng/gwarinpa/sellerpage-17389808/"),
    { kind: "user", userId: "17389808", host: "jiji.ng" },
  );
});

test("shop pages are accepted, to be resolved through a listing link", () => {
  assert.deepEqual(parseJijiTarget("https://jiji.ng/shop/12345/gadgets"), {
    kind: "shop",
    handle: null,
    url: "https://jiji.ng/shop/12345/gadgets",
    sellerGuid: null,
    host: "jiji.ng",
  });
  assert.deepEqual(parseJijiTarget("https://jiji.ng/kevin-enterprise"), {
    kind: "shop",
    handle: "kevin-enterprise",
    url: "https://jiji.ng/kevin-enterprise",
    sellerGuid: null,
    host: "jiji.ng",
  });
  assert.deepEqual(parseJijiTarget("kevin-enterprise"), {
    kind: "shop",
    handle: "kevin-enterprise",
    url: null,
    sellerGuid: null,
    host: JIJI_DEFAULT_HOST,
  });

  // A seller page without a numeric id: the guid is kept so the page's own
  // metadata can be matched against it.
  assert.deepEqual(
    parseJijiTarget("https://jiji.ng/sellerpage-ffkTwbRgL9mtIqdSX4svUuQx"),
    {
      kind: "shop",
      handle: null,
      url: "https://jiji.ng/sellerpage-ffkTwbRgL9mtIqdSX4svUuQx",
      sellerGuid: "ffkTwbRgL9mtIqdSX4svUuQx",
      host: "jiji.ng",
    },
  );

  // A seller page whose guid is not guid-shaped carries no id to match on.
  assert.equal(
    (parseJijiTarget("https://jiji.ng/sellerpage-short") as { sellerGuid: string | null })
      .sellerGuid,
    null,
  );
});

test("search, category and profile URLs are refused, not imported", () => {
  // The exact link that produced the phantom "shop" called profile.
  assert.equal(
    parseJijiTarget("https://jiji.ng/profile?guid=ffkTwbRgL9mtIqdSX4svUuQx"),
    null,
  );
  assert.equal(parseJijiTarget("https://jiji.ng/profile"), null);
  assert.equal(parseJijiTarget("https://jiji.ng/search?query=tv"), null);
  assert.equal(parseJijiTarget("https://jiji.ng/c/mobile-phones"), null);
  assert.equal(parseJijiTarget("https://jiji.ng/login"), null);
  assert.equal(parseJijiTarget("https://jiji.ng/"), null);
  assert.equal(parseJijiTarget(""), null);
  assert.equal(parseJijiTarget("ab"), null);
  assert.equal(parseJijiTarget("https://example.com/kevin-enterprise"), null);
});

test("advert links are picked out of a shop page, if it has any", () => {
  const html = [
    '<a href="/lagos/mobile-phones/iphone-11-64gb-hdOZhLA7u0r6u5lqZ1gOJhn0.html">iPhone</a>',
    '<a href="/c/mobile-phones">Mobile phones</a>',
    '<a href="https://jiji.ng/about">About</a>',
    '<link rel="canonical" href="https://jiji.ng/sellerpage-ffkTwbRgL9mtIqdSX4svUuQx">',
  ].join("");

  assert.deepEqual(advertHrefsFromHtml(html), [
    "/lagos/mobile-phones/iphone-11-64gb-hdOZhLA7u0r6u5lqZ1gOJhn0.html",
  ]);

  // A client-rendered page carries none, which is the normal case.
  assert.deepEqual(advertHrefsFromHtml("<div id=\"__nuxt\"></div>"), []);
});

test("the demo fixtures need an explicit dev-only opt-in", async () => {
  // JIJI_MOCK_IMPORT=1 but a production build: still refused.
  await withEnv({ JIJI_MOCK_IMPORT: "1", NODE_ENV: "production" }, async () => {
    assert.equal(mockImportEnabled(), false);
  });

  // The opt-in only counts when the value is exactly "1".
  await withEnv({ JIJI_MOCK_IMPORT: "true", NODE_ENV: "development" }, async () => {
    assert.equal(mockImportEnabled(), false);
  });

  await withEnv({ JIJI_MOCK_IMPORT: "1", NODE_ENV: "development" }, async () => {
    assert.equal(mockImportEnabled(), true);

    const result = await fetchSellerListings("any-shop");
    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.mocked, true);
    // Fixtures belong to no seller, so there is no id to remember.
    assert.equal(result.ok === true && result.userId, null);
    // ...and no shop URL either.
    assert.equal(result.ok === true && result.sellerPageUrl, null);

    const listings = result.ok === true ? result.listings : [];
    assert.equal(listings.length, 3);

    // Every fixture is recognisable as a fixture, so it can be found and
    // removed again: `mock-` ids and placeholder photos only.
    for (const raw of listings) {
      const mapped = mapListing(raw);
      assert.ok(mapped, "a fixture must still map through the real path");
      assert.ok(
        mapped.externalId?.startsWith(MOCK_EXTERNAL_ID_PREFIX),
        `fixture id ${String(mapped.externalId)} must keep its mock- prefix`,
      );
      for (const image of mapped.images) {
        assert.match(image, /^https:\/\/picsum\.photos\//);
      }
    }
  });
});

test("input that is not a Jiji page fails before any request is made", async () => {
  await withEnv({ JIJI_MOCK_IMPORT: undefined }, async () => {
    const result = await fetchSellerListings("https://jiji.ng/search?query=tv");

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
    assert.equal(result.ok === false && result.error, JIJI_INVALID_TARGET_MESSAGE);
  });
});

test("the failure copy never says the importer is not connected", () => {
  // Jiji is read directly now: there is no key to add and no proxy to ask.
  assert.match(JIJI_UNREACHABLE_MESSAGE, /nothing was imported/i);
  assert.doesNotMatch(JIJI_UNREACHABLE_MESSAGE, /REEF|api key|admin/i);
});

test("a live advert maps onto the columns the catalogue stores", () => {
  const mapped = mapListing({
    id: 882134,
    guid: "hdOZhLA7u0r6u5lqZ1gOJhn0",
    title: "  Iphone se 2020 64gb black  ",
    price_obj: { value: 185000, view: "₦185,000" },
    price_title: "₦185,000",
    description: "Clean, no scratch",
    images: [
      { url: "https://cdn.jiji.ng/a.webp" },
      { url: "https://cdn.jiji.ng/b.webp" },
    ],
    status: "active",
    user_id: 17389808,
  });

  assert.deepEqual(mapped, {
    name: "Iphone se 2020 64gb black",
    // The amount lives in price_obj.value; price_title is only the display form.
    price: 185000,
    description: "Clean, no scratch",
    // The cover photo only: one image per product.
    images: ["https://cdn.jiji.ng/a.webp"],
    externalId: "882134",
  });
});

test("a sold advert is dropped instead of imported as available", () => {
  const price_obj = { value: 90000 };

  assert.equal(mapListing({ title: "Hisense TV", price_obj, status: "sold" }), null);
  assert.equal(mapListing({ title: "Hisense TV", price_obj, status: "deleted" }), null);

  // No status at all (an older payload shape) is still importable, and a numeric
  // flag is not mistaken for a status string.
  assert.ok(mapListing({ title: "Hisense TV", price_obj }));
  assert.ok(mapListing({ title: "Hisense TV", price_obj, status: 1 }));
});

test("an advert with no amount is skipped instead of priced at nothing", () => {
  // Jiji's own shape for an unpriced service: value null, view "Contact for price".
  assert.equal(
    mapListing({
      title: "PVC Tarpaulin Materials",
      price_obj: { value: null, view: "Contact for price" },
      price_title: "Contact for price",
      status: "active",
    }),
    null,
  );

  // When only the display string survives, it is still read.
  const priced = mapListing({
    title: "Leather Materials",
    price_obj: { value: null, view: "₦5,500" },
    status: "active",
  });
  assert.equal(priced?.price, 5500);
});

test("unusable listings are dropped instead of half-imported", () => {
  // No price: the AI would have to invent one.
  assert.equal(mapListing({ title: "Mystery box" }), null);
  // No title.
  assert.equal(mapListing({ price: 1000 }), null);
  // Not an object at all.
  assert.equal(mapListing("Samsung Galaxy A15"), null);
  assert.equal(mapListing(null), null);

  // A listing with a real title and price but no usable photo keeps an empty
  // image list, and a non-http "image" is never stored.
  const noPhoto = mapListing({
    advertId: "abc",
    name: "HP Laptop",
    priceValue: 250000,
    image: "javascript:alert(1)",
  });
  assert.equal(noPhoto?.images.length, 0);
  assert.equal(noPhoto?.externalId, "abc");
  assert.equal(noPhoto?.description, null);
});

test("the importer source tag is JIJI", () => {
  assert.equal(JIJI_SOURCE, "JIJI");
});

test("a shop URL yields the seller handle", () => {
  assert.equal(
    extractJijiUsername("https://jiji.ng/kevin-enterprise"),
    "kevin-enterprise",
  );
  assert.equal(extractJijiUsername("jiji.ng/kevin-enterprise"), "kevin-enterprise");
  assert.equal(
    extractJijiUsername("https://www.jiji.ng/kevin-enterprise?page=2"),
    "kevin-enterprise",
  );
  assert.equal(
    extractJijiUsername("https://jiji.com.gh/shops/kevin-enterprise/"),
    "kevin-enterprise",
  );
  assert.equal(extractJijiUsername("  KEVIN-enterprise  "), "kevin-enterprise");
  // Percent-encoded handles decode before validation.
  assert.equal(
    extractJijiUsername("https://jiji.ng/kevin%2Denterprise"),
    "kevin-enterprise",
  );
});

test("page URLs are not shop handles", () => {
  // The exact link that produced the phantom import.
  assert.equal(
    extractJijiUsername("https://jiji.ng/profile?guid=ffkTwbRgL9mtIqdSX4svUuQx"),
    null,
  );
  assert.equal(extractJijiUsername("https://jiji.ng/profile"), null);
  assert.equal(extractJijiUsername("profile"), null);
  assert.equal(extractJijiUsername("https://jiji.ng/search?query=tv"), null);
  assert.equal(extractJijiUsername("https://jiji.ng/c/mobile-phones"), null);
  assert.equal(extractJijiUsername("https://jiji.ng/login"), null);
  assert.equal(extractJijiUsername("https://jiji.ng/"), null);
  assert.equal(extractJijiUsername(""), null);
});

test("only Jiji hosts are accepted", () => {
  assert.equal(extractJijiUsername("https://notjiji.ng/shop"), null);
  assert.equal(extractJijiUsername("https://jiji.ng.evil.example/shop"), null);
  assert.equal(extractJijiUsername("https://example.com/shop"), null);
  assert.equal(
    extractJijiListingGuid("https://notjiji.ng/gwarinpa/x-abc123456789.html"),
    null,
  );

  // A page is fetched directly, so credentials and an odd port are refused
  // rather than normalised into a request nobody asked for.
  assert.equal(
    parseJijiTarget(
      "https://user:pass@jiji.ng/lagos/phones/x-hmJzdAFmEMmZMY8Ol8ENvVAy",
    ),
    null,
  );
  assert.equal(
    parseJijiTarget("https://jiji.ng:8443/lagos/phones/x-hmJzdAFmEMmZMY8Ol8ENvVAy"),
    null,
  );
  // The https default port is not an odd port.
  assert.equal(
    parseJijiTarget(
      "https://jiji.ng:443/lagos/phones/laptop-hmJzdAFmEMmZMY8Ol8ENvVAy",
    )?.kind,
    "listing",
  );
});

test("duplicate detection ignores case and spacing", () => {
  assert.equal(normalizeName("  Samsung   Galaxy A15 "), "samsung galaxy a15");
  assert.equal(
    normalizeName("Samsung Galaxy A15"),
    normalizeName(" samsung  galaxy   a15 "),
  );
});

test("firstString prefers strings and keeps numbers usable", () => {
  assert.equal(firstString(undefined, "", "  keep me  ", "nope"), "keep me");
  assert.equal(firstString(null, 42), "42");
  assert.equal(firstString(null, undefined, {}), "");
});

