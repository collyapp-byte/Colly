// Jiji storefronts: reading a seller's catalogue and mapping it to products.
//
// Both routes that talk to Jiji live on top of this module: the one-off importer
// (/api/products/import-jiji) copies a shop's catalogue into Colly, and the
// two-way sync (/api/products/sync-jiji) re-reads it later to follow price and
// availability changes. Route files cannot export helpers, so the boundary lives
// here.
//
// There is no scraper key and no proxy: Jiji's own listing endpoint is public
// JSON, so the catalogue is read directly.
//
//   GET https://jiji.ng/api_web/v1/listing?user_id=<numeric seller id>&page=<n>
//     -> { adverts_list: { count, adverts: [{ id, guid, title, price_obj, ... }] } }
//
// Three properties of that endpoint shape everything below:
//
// 1. `user_id` must be the NUMERIC seller id. Any other value is not rejected —
//    it is silently ignored and the response becomes 20 adverts from 20 random
//    sellers (count ~2.4M). Importing that fills a tenant's catalogue with
//    strangers' products, so a payload is checked against the seller id we asked
//    for (`payloadIsTrusted()`) before any route is allowed to write.
// 2. The last page answers 404 rather than an empty list, so "no more pages" and
//    "no such shop" share a status; the page loop reads 404 as the end
//    (`isLastJijiPage()`).
// 3. There is no `price` field — the amount lives in `price_obj.value` (and the
//    display string in `price_title`). The product HTML has no `og:price` and no
//    JSON-LD price either, which is why the catalogue itself is always read as
//    JSON; a product page's HTML is only ever read for the seller's numeric id.
//
// What an owner can paste has changed twice, and both shapes are supported:
// product links now usually arrive WITHOUT the legacy `.html` suffix
// (`/lagos/computers-and-laptops/hp-elitebook-840-g5-<guid>`), and a shop can be
// pasted as a GUID seller page (`/sellerpage-w6HR…`) that names no numeric id in
// its URL at all. The numeric id in both cases comes from the page's own
// metadata — canonical/`og:url`, JSON-LD `seller`, `__NEXT_DATA__`/
// `__INITIAL_STATE__` `user_id`, or a `/sellerpage-<id>` link — read by
// `readJijiPageIdentity()` and `sellerIdsFromHtml()`. The domain is taken from
// the link too (`jiji.com.gh`, `jiji.co.ke`, …), so a shop is always read from
// its own country's marketplace.

/**
 * The Jiji domain used when a link does not name one (a bare seller id, a bare
 * handle). Every other country is read from the link itself: jiji.com.gh,
 * jiji.co.ke, jiji.ug, ... all answer the same endpoints, so a Ghanaian owner's
 * shop must not be queried against jiji.ng.
 */
export const JIJI_DEFAULT_HOST = "jiji.ng";

/** Path of the public listing endpoint, relative to the country host. */
export const JIJI_LISTING_API_PATH = "/api_web/v1/listing";

/** Jiji's public listing endpoint (Nigeria). No key, no account. */
export const JIJI_LISTING_API = `https://${JIJI_DEFAULT_HOST}${JIJI_LISTING_API_PATH}`;

/**
 * Candidate paths for a single advert's JSON, tried in order.
 *
 * `/api_web/v1/item/<guid>` is the live one: it answers `{ advert, seller }` for
 * exactly one advert, which is the cheapest way to learn a seller's numeric id
 * from a product link. The other two are older spellings of the same idea, kept
 * as fallbacks because Jiji's web client has moved them before and a 404 here
 * only means "try the next one".
 */
export const JIJI_ADVERT_API_PATHS = [
  "/api_web/v1/item",
  "/api_web/v1/adverts",
  "/api_web/v1/advert",
] as const;

/** Jiji can hang; fail before the owner's spinner outlives their patience. */
export const JIJI_TIMEOUT_MS = 15_000;

/**
 * Per-run ceiling. A big shop keeps the request, the single insert and the
 * background embedding fan-out bounded; re-importing picks up the rest.
 */
export const MAX_LISTINGS = 500;

/** Adverts per API page (the endpoint's own default, used to spot the last page). */
const JIJI_PAGE_SIZE = 20;

/** Hard stop on the page loop: 30 × 20 covers MAX_LISTINGS with room to spare. */
const JIJI_MAX_PAGES = 30;

/** Politeness pause between pages; Jiji throttles bursts from one address. */
const JIJI_REQUEST_DELAY_MS = 150;

/** Pages scanned when a listing link has to be traced back to its seller. */
const JIJI_MAX_SEARCH_PAGES = 5;

/**
 * A seller with more adverts than this is not a small business — it is the
 * marketplace answering an ignored filter (`count ~2.4M`), so refuse it.
 */
const JIJI_MAX_SELLER_ADVERTS = 20_000;

/** Largest JSON body accepted from the endpoint before it is treated as junk. */
const JIJI_MAX_BYTES = 6 * 1024 * 1024;

/** Value stored in `Product.externalSource` for listings that came from Jiji. */
export const JIJI_SOURCE = "JIJI";

/** Mock listing ids are prefixed so the sync job can tell them from real ones. */
export const MOCK_EXTERNAL_ID_PREFIX = "mock-";

/**
 * jiji.ng paths that are pages rather than seller handles, so pasting a search,
 * category or profile URL fails with a clear message instead of importing
 * nothing. `profile` matters most: a signed-in Jiji user copies
 * `https://jiji.ng/profile?guid=...` far more easily than the shop URL, and
 * treating it as a handle made the importer "succeed" against a shop that does
 * not exist.
 */
const RESERVED_HANDLES = new Set([
  "about",
  "account",
  "adverts",
  "api",
  "blog",
  "c",
  "catalog",
  "favorites",
  "help",
  "login",
  "messages",
  "mobile",
  "my",
  "post-ad",
  "privacy",
  "profile",
  "search",
  "sell",
  "shops",
  "signup",
  "terms",
]);

/** Jiji seller handles: letters, digits, dots, dashes and underscores. */
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

/** Any Jiji country domain (jiji.ng, jiji.com.gh, jiji.co.ke, ...). */
const JIJI_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*jiji\.[a-z.]{2,6}$/i;

/**
 * The only value `user_id` filters on. Every other shape is ignored by the API
 * instead of rejected, which is what makes the check mandatory.
 */
const JIJI_USER_ID_PATTERN = /^\d{5,12}$/;

/** An advert guid: the alphanumeric tail of a listing URL, before `.html`. */
const JIJI_ADVERT_GUID_PATTERN = /^[a-z0-9]{10,40}$/i;

/**
 * Three fixed listings used when a local clone opts into demo mode with
 * `JIJI_MOCK_IMPORT=1`. They are FIXTURES: invented names, invented prices and
 * placeholder photos from picsum.photos. They exist so the Products page can be
 * exercised without a Jiji catalogue, and they must never reach a real
 * catalogue — which is exactly what used to happen when a misconfigured importer
 * silently fell back to this list (a tenant's shop "imported" a Samsung Galaxy
 * A15, a Hisense TV and a Nexus AC that it never sold). `id`s are prefixed with
 * `mock-` so the sync job can tell them from live listings.
 */
const MOCK_LISTINGS: Array<Record<string, unknown>> = [
  {
    id: "mock-1",
    title: "Samsung Galaxy A15 128GB",
    price: 185000,
    description:
      "Brand new, sealed. 6GB RAM, 128GB storage, dual SIM and a 5000mAh battery.",
    image: "https://picsum.photos/seed/colly-jiji-1/600/600",
  },
  {
    id: "mock-2",
    title: "Hisense 32-inch Smart TV",
    price: 145000,
    description:
      "HD Smart TV with built-in Wi-Fi, Netflix and YouTube. Wall bracket included.",
    image: "https://picsum.photos/seed/colly-jiji-2/600/600",
  },
  {
    id: "mock-3",
    title: "Nexus 1.5HP Split Air Conditioner",
    price: 320000,
    description:
      "Energy-saving split AC with a copper condenser; installation kit included.",
    image: "https://picsum.photos/seed/colly-jiji-3/600/600",
  },
];

/** A listing we can insert; unusable rows are counted as skipped. */
export type MappedListing = {
  name: string;
  price: number;
  description: string | null;
  images: string[];
  /**
   * The listing's id on Jiji (`advertId` / `id` / `uuid` from the payload).
   * Null when the payload had none; callers stamp a placeholder before saving.
   */
  externalId: string | null;
};

/**
 * What an owner can paste, normalised. `user` is the only shape that is directly
 * fetchable; `listing` and `shop` have to be traced back to the numeric id first
 * (`resolveSellerId()`).
 */
export type JijiTarget =
  | {
      kind: "user";
      userId: string;
      /** Country host to query; `jiji.ng` for a bare id. */
      host: string;
    }
  | {
      kind: "listing";
      /** Advert guid from the listing URL, the identity Jiji's search can match. */
      guid: string;
      /** Advert title words, used as the `query` of the lookup search. */
      query: string;
      /** `region_slug` from the URL path, which narrows the search enormously. */
      regionSlug: string | null;
      /** The advert page itself, read for the seller its metadata names. */
      url: string;
      /** Country host the link came from (`jiji.com.gh`, ...). */
      host: string;
    }
  | {
      kind: "shop";
      handle: string | null;
      url: string | null;
      /** `/sellerpage-<guid>` — the guid form of a seller page. */
      sellerGuid: string | null;
      /** Country host the link came from (`jiji.com.gh`, ...). */
      host: string;
    };

export type JijiListingsResult =
  | {
      ok: true;
      listings: unknown[];
      mocked: boolean;
      /** Numeric seller id the listings were read from; null for fixtures. */
      userId: string | null;
      /** Canonical shop URL to remember for the sync job; null for fixtures. */
      sellerPageUrl: string | null;
    }
  | { ok: false; status: number; error: string; detail?: string };

/** One page of the listing endpoint, before it is trusted or mapped. */
type JijiPage =
  | { kind: "page"; payload: unknown }
  | { kind: "end" }
  | { kind: "error"; result: { ok: false; status: number; error: string; detail?: string } };

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** First non-empty string (or finite number) among the given field aliases. */
export function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

/**
 * Placeholder id for a listing the endpoint returned without one.
 *
 * It only has to be stable for the row it is stored on: the sync job falls back
 * to matching by name when an id no longer appears in the live payload, so a
 * placeholder never marks a real listing out of stock.
 */
export function createExternalId(): string {
  return `jiji-${Math.random().toString(36).slice(2, 12)}`;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // Malformed escape sequence: keep the raw segment rather than throwing.
    return segment;
  }
}

/**
 * Extracts the seller handle from a pasted shop link.
 *
 * Accepts `https://jiji.ng/my-shop`, `https://www.jiji.ng/my-shop?page=2`,
 * `https://jiji.com.gh/shops/my-shop/` and a bare `my-shop` handle. Returns
 * null for anything that is not a Jiji shop page.
 */
export function extractJijiUsername(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  // A bare handle has no slash and no dot ("my-shop-name").
  if (!value.includes("/") && !value.includes(".")) {
    const handle = value.toLowerCase();
    return HANDLE_PATTERN.test(handle) && !RESERVED_HANDLES.has(handle)
      ? handle
      : null;
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  if (!JIJI_HOST_PATTERN.test(url.hostname)) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean).map(decodeSegment);

  // Seller pages live at /<handle>, with /shops/<handle> as the legacy form.
  const handle =
    segments[0]?.toLowerCase() === "shops" ? segments[1] : segments[0];

  if (!handle) {
    return null;
  }

  const normalised = handle.trim().toLowerCase();
  return HANDLE_PATTERN.test(normalised) && !RESERVED_HANDLES.has(normalised)
    ? normalised
    : null;
}

/** True when `value` is a numeric Jiji seller id — the only shape `user_id` takes. */
export function isJijiUserId(value: string): boolean {
  return JIJI_USER_ID_PATTERN.test(value.trim());
}

/**
 * A Jiji URL, or null for anything else (including plain text without a host).
 *
 * A pasted product or shop page is fetched directly, so the URL has to be a
 * plain one: credentials and a non-default port are not Jiji, and a link that
 * carries them is refused rather than normalised into a request nobody asked
 * for. Only `https` is ever constructed.
 */
function asJijiUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  if (
    !JIJI_HOST_PATTERN.test(url.hostname) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    return null;
  }

  return url;
}

/**
 * The country host a Jiji link belongs to, or the Nigerian default.
 *
 * Always a bare hostname: no scheme, no port, no credentials, and `www.`
 * stripped, so it can be dropped straight into an API URL. An input that is not
 * a Jiji host is replaced by `JIJI_DEFAULT_HOST` rather than trusted — the value
 * comes from a pasted link, which is owner-controlled.
 */
export function jijiHostOf(value: URL | string): string {
  const raw = typeof value === "string" ? value : value.hostname;
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/:\d+$/, "");

  return JIJI_HOST_PATTERN.test(host) ? host : JIJI_DEFAULT_HOST;
}

/** `https://<country host>`, e.g. `https://jiji.com.gh`. */
export function jijiOrigin(host: string = JIJI_DEFAULT_HOST): string {
  return `https://${jijiHostOf(host)}`;
}

/**
 * Whether a path segment's tail is an advert guid rather than a category word.
 *
 * Jiji guids are base62-ish hashes (`hmJzdAFmEMmZMY8Ol8ENvVAy`): long, mixed
 * case, and almost always carrying a digit. Every one of those properties is
 * required, because a category path (`/lagos/accessories`) satisfies the plain
 * alphanumeric pattern and must never be read as an advert.
 */
export function looksLikeJijiGuid(value: string): boolean {
  const guid = value.trim();
  return (
    JIJI_ADVERT_GUID_PATTERN.test(guid) &&
    guid.length >= 15 &&
    /\d/.test(guid) &&
    /[a-z]/i.test(guid)
  );
}

/**
 * The advert guid of a Jiji pathname, with or without the legacy `.html` suffix.
 *
 * Both shapes Jiji serves today are accepted:
 *
 * - `/gwarinpa/mobile-phones/iphone-se-2020-64gb-black-<guid>.html` (legacy,
 *   and still the canonical form on many listings);
 * - `/lagos/computers-and-laptops/hp-elitebook-840-g5-<guid>` and
 *   `/lagos/computers-and-laptops/<guid>` (current pages, no suffix).
 *
 * Returns null for everything else, including category pages, seller pages and
 * `c/` listings, so a page that is not one advert cannot become one.
 */
export function listingGuidFromPath(pathname: string): string | null {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeSegment(segment));

  const last = segments.at(-1);
  if (!last) {
    return null;
  }

  // `/sellerpage-<guid>` is a shop, not an advert — its tail is guid-shaped.
  if (/^sellerpage-/i.test(last)) {
    return null;
  }

  const hasHtml = /\.html$/i.test(last);
  const slug = last.replace(/\.html$/i, "");
  const dash = slug.lastIndexOf("-");
  const tail = dash >= 0 ? slug.slice(dash + 1) : slug;
  const title = dash >= 0 ? slug.slice(0, dash) : "";

  if (!JIJI_ADVERT_GUID_PATTERN.test(tail)) {
    return null;
  }

  // `.html` only ever appears on an advert page, so the suffix itself is the
  // proof; the guid is still required to be the trailing dash token.
  if (hasHtml) {
    return dash >= 0 ? tail : null;
  }

  if (!looksLikeJijiGuid(tail)) {
    return null;
  }

  if (dash >= 0) {
    // `<title>-<guid>`: the title half has to be a real word, otherwise a
    // category whose last word is guid-shaped would pass.
    return title.trim().length >= 2 ? tail : null;
  }

  // A bare `<guid>` segment only means an advert under a region/category path.
  return segments.length >= 2 ? tail : null;
}

/** `sellerpage-<id>` in any path position (region prefixes are allowed). */
function sellerPageSegment(segments: string[]): string | null {
  for (const segment of segments) {
    const match = /^sellerpage-(.+)$/i.exec(segment);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * The `region_slug` of a listing URL. Jiji addresses an advert as
 * `/<region>/<category>/<title>-<guid>.html`, so the region is the first segment
 * — and it is what takes a lookup search from ~46,000 adverts down to ~160.
 */
function regionSlugOf(segments: string[]): string | null {
  if (segments.length < 3) {
    return null;
  }

  const region = segments[0]?.trim() ?? "";
  return /^[a-z0-9][a-z0-9-]{1,60}$/i.test(region) ? region.toLowerCase() : null;
}

/** The advert title words of a listing URL, used as the lookup `query`. */
function listingTitleQuery(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const last = decodeSegment(segments.at(-1) ?? "").replace(/\.html$/i, "");
  const dash = last.lastIndexOf("-");

  return (dash > 0 ? last.slice(0, dash) : last)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Reads the advert guid out of a listing URL — with or without `.html`.
 *
 * Listing URLs look like
 * `https://jiji.ng/gwarinpa/mobile-phones/iphone-se-2020-64gb-black-hdOZ….html`
 * on the legacy pages and like
 * `https://jiji.ng/lagos/computers-and-laptops/hp-elitebook-840-g5-hmJzdAF…`
 * (or `.../<guid>` on its own) on the current ones. Either way the guid is the
 * trailing dash-separated token, or the whole last segment when it is a bare
 * hash. It is the same `guid` the API returns per advert, which is what makes a
 * pasted link traceable back to the seller who posted it.
 *
 * Returns null for anything that is not an advert page, which is what keeps a
 * pasted category URL from being imported as a product.
 */
export function extractJijiListingGuid(raw: string): string | null {
  const url = asJijiUrl(raw);
  return url ? listingGuidFromPath(url.pathname) : null;
}

/**
 * Normalises what an owner pasted into something the fetcher can act on.
 *
 * Accepted, in order of how directly they can be read:
 *
 * - a numeric seller id (`17389808`) — the API filters on this;
 * - a seller page with a numeric id (`https://jiji.ng/sellerpage-17389808`) —
 *   same thing, in URL form;
 * - a seller page with a guid (`https://jiji.ng/sellerpage-w6HR...`) — its
 *   `<script>`/meta data names the numeric id (`resolveShopSeller()`);
 * - a listing URL, with or without `.html`, on any Jiji country domain — the
 *   advert page is read for its seller, then Jiji's own search
 *   (`resolveSellerId()`);
 * - a shop page (`/shop/<shop_id>/…`, `/shops/<handle>`, `/<handle>`) — the
 *   page is read for its seller or for one listing link.
 *
 * Search, category and profile URLs return null: they are pages about Jiji, not
 * about this seller, and "importing" one used to create a phantom shop called
 * `profile` that imported nothing.
 */
export function parseJijiTarget(raw: string): JijiTarget | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (JIJI_USER_ID_PATTERN.test(value)) {
    return { kind: "user", userId: value, host: JIJI_DEFAULT_HOST };
  }

  const url = asJijiUrl(value);
  if (!url) {
    // Bare handle, no scheme: `my-shop-name`. Anything with a slash, a scheme or
    // a dot is a URL that was refused above and must stay refused — falling back
    // to "first path segment" is what once made `/profile?guid=…` import a
    // phantom shop called `profile`.
    if (/[/:.]/.test(value)) {
      return null;
    }

    const handle = extractJijiUsername(value);
    return handle?.length && handle.length >= 3
      ? {
          kind: "shop",
          handle,
          url: null,
          sellerGuid: null,
          host: JIJI_DEFAULT_HOST,
        }
      : null;
  }

  const host = jijiHostOf(url);
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeSegment(segment));

  const sellerPage = sellerPageSegment(segments);
  if (sellerPage) {
    const sellerGuid = JIJI_ADVERT_GUID_PATTERN.test(sellerPage)
      ? sellerPage
      : null;

    return isJijiUserId(sellerPage)
      ? { kind: "user", userId: sellerPage.trim(), host }
      : {
          kind: "shop",
          handle: null,
          url: url.toString(),
          sellerGuid,
          host,
        };
  }

  const guid = listingGuidFromPath(url.pathname);
  if (guid) {
    return {
      kind: "listing",
      guid,
      query: listingTitleQuery(url),
      regionSlug: regionSlugOf(segments),
      url: url.toString(),
      host,
    };
  }

  // `/shop/<id>`, `/shops/<handle>` and the region-prefixed forms.
  if (
    segments.some((segment) => {
      const lower = segment.toLowerCase();
      return lower === "shop" || lower === "shops";
    })
  ) {
    return {
      kind: "shop",
      handle: null,
      url: url.toString(),
      sellerGuid: null,
      host,
    };
  }

  // `/my-shop-name`: one path segment and not one of Jiji's own pages.
  if (segments.length === 1) {
    const handle = extractJijiUsername(segments[0]);
    if (handle && handle.length >= 3) {
      return { kind: "shop", handle, url: url.toString(), sellerGuid: null, host };
    }
  }

  return null;
}

/**
 * Reads a price from a number, a display string (NGN 1,200,000) or an object
 * shape such as `{ value: 1200000, currency: "NGN" }`. Returns null when the
 * listing has no usable price, so the caller can skip it.
 */
function parsePrice(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string") {
    // "₦1,200,000", "NGN 1200000.00" and "1200000" all collapse to digits + dot.
    const cleaned = value.replace(/[^\d.]/g, "");
    if (!cleaned) {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return parsePrice(
    record.value ??
      record.amount ??
      record.raw ??
      // `{ value: null, view: "₦180,000" }` happens; the display string is then
      // the only amount there is.
      record.view ??
      record.price ??
      record.rawPrice,
  );
}

/** First http(s) image URL found in a string, array or object shape. */
function readImageUrl(value: unknown, depth = 0): string | null {
  if (depth > 2 || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const url = value.trim();
    return /^https?:\/\//i.test(url) ? url : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = readImageUrl(entry, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return readImageUrl(
    record.url ??
      record.src ??
      record.image ??
      record.imageUrl ??
      record.thumbnail ??
      record.cover,
    depth + 1,
  );
}

/**
 * Finds the adverts array in a listing payload.
 *
 * Jiji's own envelope is `{ adverts_list: { count, adverts: [...] } }`; the
 * other shapes are kept because they are cheap to accept and the endpoint is
 * undocumented (`[...]`, `{ data: [...] }`, `{ data: { listings: [...] } }`,
 * `{ results: [...] }`).
 */
export function readAdverts(payload: unknown, depth = 0): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record || depth > 2) {
    return [];
  }

  const keys = [
    "adverts",
    "listings",
    "products",
    "items",
    "results",
    "data",
    "adverts_list",
  ];

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === "object") {
      const nested = readAdverts(value, depth + 1);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

/**
 * Total adverts the payload claims to hold (`adverts_list.count` and friends).
 *
 * This is the tell for an ignored filter: ask for one seller's adverts with an
 * id Jiji does not understand and the answer is the whole marketplace with a
 * count in the millions. Null means "the payload did not say".
 */
export function readListCount(payload: unknown): number | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const list = asRecord(record.adverts_list);
  const candidates = [
    list?.count,
    record.count,
    record.total,
    record.total_count,
    record.totalCount,
  ];

  for (const candidate of candidates) {
    const value =
      typeof candidate === "string" ? Number(candidate.replace(/[^\d]/g, "")) : candidate;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return null;
}

/** The seller id an advert belongs to (top level, or nested under `seller`). */
export function advertUserId(raw: unknown): string | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const seller = asRecord(record.seller);
  const id = firstString(
    record.user_id,
    record.userId,
    record.seller_id,
    record.sellerId,
    seller?.id,
    seller?.user_id,
    seller?.userId,
  );

  return id || null;
}

/** An advert's own guid, used to match a pasted listing URL to its advert. */
export function advertGuid(raw: unknown): string | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const guid = firstString(record.guid, record.advert_guid, record.advertGuid);
  return guid || null;
}

/**
 * Whether a payload really is the catalogue of the seller we asked for.
 *
 * The endpoint never says "unknown seller": it ignores a value it cannot use and
 * answers with the whole marketplace, which is why this check is the difference
 * between importing one shop and importing 500 strangers' products. The three
 * conditions are the ones that cannot be argued with:
 *
 * - the payload must be the listing envelope at all (an error object with a
 *   `status` key has no adverts and no count);
 * - the advertised total must be a small-business number, not millions;
 * - every advert must belong to `expectedUserId` when we know it.
 */
export function payloadIsTrusted(
  payload: unknown,
  expectedUserId: string | null,
): boolean {
  const adverts = readAdverts(payload);
  const count = readListCount(payload);

  // `{ status, status_code, url }` — Jiji's HTML-free error shape.
  if (adverts.length === 0 && count !== 0) {
    return false;
  }

  if (count !== null && count > JIJI_MAX_SELLER_ADVERTS) {
    return false;
  }

  if (!expectedUserId) {
    return true;
  }

  return adverts.every((advert) => advertUserId(advert) === expectedUserId);
}

/** 404 (and 410) mean "that page does not exist" — the last page of a shop. */
export function isLastJijiPage(status: number): boolean {
  return status === 404 || status === 410;
}

/**
 * Advert links found in a shop page's HTML.
 *
 * Jiji renders shop pages on the server, so they normally carry advert links —
 * often with tracking query strings (`?page=1&pos=1&…`) that are stripped here.
 * Every same-origin path that names an advert is returned — the legacy `….html`
 * form and the current suffix-free form alike — and category, `c/` and seller
 * links are dropped because they name a page rather than a listing.
 */
export function advertHrefsFromHtml(html: string): string[] {
  const found = new Set<string>();

  for (const match of html.matchAll(/href=["']([^"'\s]+)["']/gi)) {
    const raw = match[1];
    // Only paths on Jiji itself; an absolute or protocol-relative link could
    // point anywhere and the guid check alone would not make it safe.
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
      continue;
    }

    const pathname = raw.split(/[?#]/)[0] ?? "";
    if (!listingGuidFromPath(pathname)) {
      continue;
    }

    found.add(pathname);
    if (found.size >= 5) {
      break;
    }
  }

  return [...found];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `content` of a `<meta property|name="…">` tag, whichever order it is written. */
function metaContent(html: string, property: string): string | null {
  const key = escapeRegExp(property);
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return null;
}

/** `href` of `<link rel="canonical">`, whichever order it is written. */
function canonicalHref(html: string): string | null {
  const patterns = [
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return null;
}

/** Script tags that carry a page's data: its JSON-LD and its client state. */
const JIJI_STATE_SCRIPT =
  /__NEXT_DATA__|__NUXT_DATA__|__INITIAL_STATE__|__PRELOADED_STATE__|__NUXT__|__APOLLO_STATE__/;

/**
 * The JSON blobs a Jiji page embeds.
 *
 * Jiji is server-rendered, so the advert or seller a page is about is usually in
 * the HTML twice: as schema.org JSON-LD and as the client state
 * (`__NEXT_DATA__`, `window.__INITIAL_STATE__`, ...). Both are read here, and
 * both are optional — anything that is not parseable JSON is skipped rather than
 * guessed at.
 */
export function pageJsonBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1] ?? "";
    const body = (match[2] ?? "").trim();
    if (!body || body.length > 500_000) {
      continue;
    }

    const isJsonLd = /type=["']application\/ld\+json["']/i.test(attributes);
    // `window.__INITIAL_STATE__ = {...}` has no attribute to match on, so the
    // assignment itself counts as the marker.
    const stripped = body.replace(
      /^(?:window|self)\.[A-Za-z_$][\w$.]*\s*=\s*/,
      "",
    );
    const isState = JIJI_STATE_SCRIPT.test(attributes) || stripped !== body;

    if (!isJsonLd && !isState) {
      continue;
    }

    const text = stripped.replace(/;\s*$/, "").trim();
    if (!text.startsWith("{") && !text.startsWith("[")) {
      continue;
    }

    try {
      blocks.push(JSON.parse(text) as unknown);
    } catch {
      // Truncated or escaped: not data we can read.
    }
  }

  return blocks;
}

/** What a Jiji page says about itself, from its canonical/og URLs and JSON-LD. */
export type JijiPageIdentity = {
  canonicalUrl: string | null;
  ogUrl: string | null;
  /** The advert the page claims to be, when the page is an advert page. */
  advertGuid: string | null;
  /** The guid seller page the page claims to be, e.g. `w6HR…`. */
  sellerGuid: string | null;
  /** True when the page describes a single product (JSON-LD Product/Offer). */
  isProductPage: boolean;
};

/**
 * Reads a page's own identity.
 *
 * This is the cross-check the resolvers need: a page whose canonical URL names a
 * different advert or a different seller is not the page that was pasted, so
 * nothing on it may be attributed to the shop being imported.
 */
export function readJijiPageIdentity(html: string): JijiPageIdentity {
  const canonicalUrl = canonicalHref(html);
  const ogUrl = metaContent(html, "og:url");

  let advertGuid: string | null = null;
  let sellerGuid: string | null = null;

  for (const declared of [canonicalUrl, ogUrl]) {
    if (!declared) {
      continue;
    }

    let url: URL;
    try {
      url = new URL(declared, `https://${JIJI_DEFAULT_HOST}`);
    } catch {
      continue;
    }

    advertGuid ??= listingGuidFromPath(url.pathname);

    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeSegment(segment));
    const sellerPage = sellerPageSegment(segments);

    if (
      !sellerGuid &&
      sellerPage &&
      !isJijiUserId(sellerPage) &&
      JIJI_ADVERT_GUID_PATTERN.test(sellerPage)
    ) {
      sellerGuid = sellerPage;
    }
  }

  const isProductPage =
    /<meta[^>]+property=["']og:type["'][^>]*content=["']product["']/i.test(html) ||
    /["']@type["']\s*:\s*["'](?:product|individualproduct|offer)["']/i.test(html);

  return { canonicalUrl, ogUrl, advertGuid, sellerGuid, isProductPage };
}

/** JSON keys that name a seller outright. */
const SELLER_SCOPED_KEYS = new Set([
  "seller",
  "sellerinfo",
  "owner",
  "advertiser",
  "author",
  "offeredby",
  "brand",
]);

/** Keys that hold the id of the object they sit in. */
const SELLER_ID_KEYS = ["id", "user_id", "userId", "seller_id", "sellerId"];

/** Keys that hold a seller id anywhere in a document. */
const GENERIC_SELLER_ID_KEYS = new Set([
  "user_id",
  "userid",
  "seller_id",
  "sellerid",
]);

type SellerIdBuckets = {
  /** Ids read from a `seller`/`author`/`offeredBy` object: about this page. */
  strong: string[];
  /** Ids read from a bare `user_id` anywhere in the document. */
  weak: string[];
};

function usableUserId(value: unknown): string | null {
  const id = firstString(value).trim();
  return id && isJijiUserId(id) ? id : null;
}

/** `https://jiji.ng/sellerpage-17389808` or `?user_id=17389808` → the id. */
function sellerIdFromLink(link: string): string | null {
  const path = /\/sellerpage-(\d{5,12})(?:[/?#]|$)/i.exec(link);
  if (path?.[1]) {
    return path[1];
  }

  const query = /[?&](?:user_id|seller_id)=(\d{5,12})(?:&|#|$)/i.exec(link);
  return query?.[1] ?? null;
}

function collectSellerIds(
  value: unknown,
  buckets: SellerIdBuckets,
  depth = 0,
): void {
  if (depth > 10 || buckets.strong.length + buckets.weak.length > 20) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSellerIds(item, buckets, depth + 1);
    }
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    // `sellerId`, `seller_id` and `seller id` all collapse to `sellerid`.
    const lower = key.toLowerCase().replace(/[^a-z_]/g, "");

    if (GENERIC_SELLER_ID_KEYS.has(lower)) {
      const id = usableUserId(child);
      if (id) {
        buckets.weak.push(id);
      }
      continue;
    }

    if (!SELLER_SCOPED_KEYS.has(lower)) {
      collectSellerIds(child, buckets, depth + 1);
      continue;
    }

    const nested = asRecord(child);
    if (nested) {
      for (const idKey of SELLER_ID_KEYS) {
        const id = usableUserId(nested[idKey]);
        if (id) {
          buckets.strong.push(id);
          break;
        }
      }

      for (const linkKey of [
        "@id",
        "url",
        "link",
        "identifier",
        "profileUrl",
        // A seller object may put its page URL in `id` rather than an id.
        "id",
      ]) {
        const link = firstString(nested[linkKey]);
        const id = link ? sellerIdFromLink(link) : null;
        if (id) {
          buckets.strong.push(id);
          break;
        }
      }
    }

    collectSellerIds(child, buckets, depth + 1);
  }
}

/** Which page the ids found in an HTML document have to belong to. */
export type SellerIdOptions = {
  /** The advert the page must be about, when the owner pasted a product link. */
  advertGuid?: string | null;
  /** The guid seller page the owner pasted, e.g. `w6HR…`. */
  sellerGuid?: string | null;
};

/**
 * Numeric seller ids a Jiji page names, most trustworthy first.
 *
 * This is what makes a product link without `.html`, or a `/sellerpage-<guid>`
 * link, resolvable at all: neither carries a numeric id, but the pages they open
 * publish one in their metadata. The order is deliberate —
 *
 * 1. ids from a `seller` / `author` / `offeredBy` object (JSON-LD or state),
 * 2. ids from a bare `user_id` in the page's client state,
 * 3. ids in `/sellerpage-<id>` links,
 *
 * and 2 and 3 are only believed when the page is recognisably about ONE advert
 * or ONE seller. A category grid names dozens of sellers, and picking the first
 * one would import a stranger's catalogue.
 *
 * A page whose canonical URL names a different advert or seller than the one
 * asked for yields nothing at all.
 */
export function sellerIdsFromHtml(
  html: string,
  options: SellerIdOptions = {},
): string[] {
  const identity = readJijiPageIdentity(html);

  const advertMatches =
    !options.advertGuid ||
    !identity.advertGuid ||
    identity.advertGuid.toLowerCase() === options.advertGuid.toLowerCase();
  const sellerMatches =
    !options.sellerGuid ||
    !identity.sellerGuid ||
    identity.sellerGuid.toLowerCase() === options.sellerGuid.toLowerCase();

  if (!advertMatches || !sellerMatches) {
    return [];
  }

  const buckets: SellerIdBuckets = { strong: [], weak: [] };
  for (const block of pageJsonBlocks(html)) {
    collectSellerIds(block, buckets);
  }

  const linkedIds: string[] = [];
  for (const match of html.matchAll(
    /\/sellerpage-(\d{5,12})(?=["'<>\s?#]|$)/gi,
  )) {
    if (match[1]) {
      linkedIds.push(match[1]);
    }
  }

  const pageScope =
    identity.isProductPage ||
    Boolean(identity.advertGuid) ||
    Boolean(identity.sellerGuid) ||
    Boolean(options.advertGuid) ||
    Boolean(options.sellerGuid);

  const ids = [
    ...buckets.strong,
    ...(pageScope ? [...buckets.weak, ...linkedIds] : []),
  ];

  return [...new Set(ids.filter(isJijiUserId))];
}

/**
 * The listing id as Jiji exposes it: the numeric `id` of the advert, with the
 * usual aliases accepted (and a nested `advert` / `item` object). The guid is
 * only a fallback — it identifies the same advert but the sync job matches on
 * `id` first, and both are stable for the life of the listing.
 */
function readExternalId(record: Record<string, unknown>): string | null {
  const nested = asRecord(record.advert) ?? asRecord(record.item);

  const id = firstString(
    record.advertId,
    record.advert_id,
    record.id,
    nested?.advertId,
    nested?.id,
    record.guid,
    record.uuid,
    record.itemId,
    nested?.uuid,
  );

  return id || null;
}

/**
 * Maps one listing onto the Product fields we store.
 *
 * A listing that is no longer live (Jiji reports `status: "active"` for live
 * adverts) is dropped rather than imported as an available product: quoting a
 * sold item is worse than not having it.
 */
export function mapListing(raw: unknown): MappedListing | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const status =
    typeof record.status === "string" ? record.status.trim().toLowerCase() : "";
  if (status && status !== "active") {
    return null;
  }

  const name = firstString(
    record.title,
    record.name,
    record.subject,
    record.advertTitle,
    record.headline,
  )
    .replace(/\s+/g, " ")
    .trim();

  // Jiji answers `price_obj: { value: 70000, view: "₦70,000" }`; other payload
  // shapes put the amount (or only the display string) in `price`.
  const price = parsePrice(
    record.price_obj ??
      record.priceObj ??
      record.price ??
      record.price_title ??
      record.priceTitle ??
      record.amount ??
      record.priceValue ??
      record.priceString ??
      record.cost ??
      record.rawPrice,
  );

  if (!name || price === null) {
    return null;
  }

  const description =
    firstString(
      record.description,
      record.desc,
      record.body,
      record.details,
      record.text,
    ) || null;

  // One image per product: the listing's cover photo.
  const image = readImageUrl(
    record.images ??
      record.image ??
      record.imageUrl ??
      record.image_url ??
      record.photo ??
      record.photos ??
      record.pictures ??
      record.thumbnail ??
      record.coverImage,
  );

  return {
    name,
    price,
    description,
    images: image ? [image] : [],
    externalId: readExternalId(record),
  };
}

/**
 * Case- and whitespace-insensitive name key. Used to skip duplicates on import
 * and as the fallback match in the sync job.
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Owner-facing copy when Jiji cannot be read: blocked, throttled, or answering
 * something that is not a listing payload. Nothing is written in that case — the
 * importer says so instead of importing a guess.
 */
export const JIJI_UNREACHABLE_MESSAGE =
  "We couldn't read that shop from Jiji just now, so nothing was imported. Please try again in a minute.";

/**
 * A shop or seller page we could not trace to a seller id. Those pages are
 * rendered in the browser, so the listing links inside them are often not in the
 * HTML; one product link is always enough.
 */
export const JIJI_SHOP_UNRESOLVED_MESSAGE =
  "We couldn't match that shop page to its listings. Open your shop on Jiji, copy ONE of your product links and paste that instead.";

/** Input that is not a shop, a product link or a seller id. */
export const JIJI_INVALID_TARGET_MESSAGE =
  "That is not a Jiji shop or product link. Paste a product link from your shop, your shop link, or your Jiji seller id.";

/** A shop we could read, but which has no live listings. */
export const JIJI_EMPTY_SHOP_MESSAGE =
  "We could not find any live listings on that Jiji shop yet.";

/**
 * Mock listings are demo fixtures, so they are opt-in and never available in a
 * production build: `JIJI_MOCK_IMPORT=1` in a local `.env` only.
 */
export function mockImportEnabled(): boolean {
  return (
    process.env.JIJI_MOCK_IMPORT === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

/** Headers the listing endpoint answers as JSON to. */
const JIJI_HEADERS: Record<string, string> = {
  "Accept-Language": "en-NG,en;q=0.9",
  Referer: "https://jiji.ng/",
  // A bare fetch User-Agent is served the HTML shell; the JSON endpoint expects
  // a browser.
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds a listing-endpoint URL with only the parameters Jiji honours.
 *
 * `user_id` is the one that matters (numeric seller id). `query` and
 * `region_slug` are how a pasted listing link is traced back to its seller.
 * Anything empty is dropped rather than sent as `""`.
 *
 * `host` is the country domain the owner's link came from, so a Ghanaian or
 * Kenyan shop is read from its own marketplace. An input that is not a Jiji host
 * falls back to jiji.ng (`jijiHostOf()`), never to whatever was pasted.
 */
export function jijiListingUrl(
  params: Record<string, string | number | null | undefined>,
  host: string = JIJI_DEFAULT_HOST,
): string {
  const url = new URL(`${jijiOrigin(host)}${JIJI_LISTING_API_PATH}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * One advert's JSON on the given endpoint path.
 *
 * The path comes from `JIJI_ADVERT_API_PATHS`; the guid is URL-encoded because a
 * guid is alphanumeric today but must never be able to change the request path.
 */
export function jijiAdvertUrl(
  guid: string,
  path: string,
  host: string = JIJI_DEFAULT_HOST,
): string {
  return `${jijiOrigin(host)}${path.replace(/\/+$/, "")}/${encodeURIComponent(guid)}`;
}

/**
 * The canonical shop URL for a seller id — what `Business.jijiShopUrl` stores so
 * a later sync reads the id straight away instead of tracing a product link
 * again. Kept on the seller's own country domain.
 */
export function jijiSellerPageUrl(
  userId: string,
  host: string = JIJI_DEFAULT_HOST,
): string {
  return `${jijiOrigin(host)}/sellerpage-${encodeURIComponent(userId.trim())}`;
}

/** A failed request, already in the shape the routes return. */
type JijiFailure = { ok: false; status: number; error: string; detail?: string };

/** A seller id we managed to resolve. */
type SellerLookup = { ok: true; userId: string } | JijiFailure;

type JijiResponse =
  | { kind: "ok"; contentType: string; body: string }
  | { kind: "error"; result: JijiFailure };

/**
 * One GET against Jiji.
 *
 * Every outcome that is not "a 2xx body" becomes a `JijiFailure` with copy the
 * owner can act on, because the alternative — a partial read that looks like a
 * successful one — is what put strangers' products in tenants' catalogues before.
 */
async function jijiRequest(url: string, accept: string): Promise<JijiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JIJI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { ...JIJI_HEADERS, Accept: accept },
      cache: "no-store",
      // Profile and shop URLs redirect to their canonical page; following that
      // is cheaper than resolving it ourselves.
      redirect: "follow",
      signal: controller.signal,
    });

    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > JIJI_MAX_BYTES) {
      return {
        kind: "error",
        result: {
          ok: false,
          status: 502,
          error: JIJI_UNREACHABLE_MESSAGE,
          detail: "Jiji answered with a body that is too large to read",
        },
      };
    }

    const body = await response.text();

    if (body.length > JIJI_MAX_BYTES) {
      return {
        kind: "error",
        result: {
          ok: false,
          status: 502,
          error: JIJI_UNREACHABLE_MESSAGE,
          detail: "Jiji answered with a body that is too large to read",
        },
      };
    }

    if (!response.ok) {
      return {
        kind: "error",
        result: {
          // 404 is how the endpoint says "no such page / no such shop".
          ok: false,
          status: isLastJijiPage(response.status) ? 404 : 502,
          error: isLastJijiPage(response.status)
            ? JIJI_EMPTY_SHOP_MESSAGE
            : JIJI_UNREACHABLE_MESSAGE,
          detail: `Jiji responded with HTTP ${response.status}`,
        },
      };
    }

    return {
      kind: "ok",
      contentType: response.headers.get("content-type") ?? "",
      body,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        kind: "error",
        result: {
          ok: false,
          status: 504,
          error: "Jiji took too long to respond. Please try again.",
        },
      };
    }

    return {
      kind: "error",
      result: {
        ok: false,
        status: 502,
        error: JIJI_UNREACHABLE_MESSAGE,
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}


/**
 * One page of the listing endpoint.
 *
 * A 404 comes back as `end` rather than an error: that is the documented end of
 * a shop's pages, and the same answer a shop that no longer exists gives — in
 * both cases there is nothing more to import. A body that is not JSON is an
 * error, never an empty shop: a blocked request usually arrives as a 200 HTML
 * page, and treating that as "no listings" would quietly mark a catalogue out of
 * stock.
 */
async function jijiGetPage(url: string): Promise<JijiPage> {
  const response = await jijiRequest(url, "application/json, text/plain, */*");

  if (response.kind === "error") {
    return response.result.status === 404
      ? { kind: "end" }
      : { kind: "error", result: response.result };
  }

  if (!/json/i.test(response.contentType)) {
    return {
      kind: "error",
      result: {
        ok: false,
        status: 502,
        error: JIJI_UNREACHABLE_MESSAGE,
        detail: `Jiji answered with ${response.contentType || "no content type"}`,
      },
    };
  }

  try {
    return { kind: "page", payload: JSON.parse(response.body) as unknown };
  } catch {
    return {
      kind: "error",
      result: {
        ok: false,
        status: 502,
        error: JIJI_UNREACHABLE_MESSAGE,
        detail: "Jiji returned invalid JSON",
      },
    };
  }
}

/** A page's HTML, or null when it could not be read. */
async function jijiGetHtml(url: string): Promise<string | null> {
  const response = await jijiRequest(url, "text/html,application/xhtml+xml");
  return response.kind === "ok" ? response.body : null;
}

/** The advert's own URL, absolute or Jiji-relative, from any alias. */
function advertListingUrl(raw: unknown): string | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const url = firstString(
    record.url,
    record.link,
    record.advert_url,
    record.advertUrl,
  );

  return url || null;
}


/** The first advert in a payload that carries the guid we asked for. */
function findAdvertByGuid(
  payload: unknown,
  guid: string,
): Record<string, unknown> | null {
  const record = asRecord(payload);
  const candidates: unknown[] = [
    payload,
    ...readAdverts(payload),
    record?.advert,
    record?.advert_data,
    record?.data,
    record?.item,
  ];

  for (const candidate of candidates) {
    if (advertGuid(candidate)?.toLowerCase() === guid) {
      return asRecord(candidate);
    }
  }

  return null;
}

/**
 * The seller id of an item-envelope payload (`/api_web/v1/item/<guid>`).
 *
 * That endpoint answers `{ advert, seller }`, and the advert itself carries no
 * `user_id` at all — the id lives on `seller.id`. The two blocks are tied by
 * `seller.advert_id === advert.id`, so a seller block that belongs to some other
 * advert is refused rather than attributed to this one.
 */
function envelopeSellerId(
  payload: unknown,
  advert: Record<string, unknown>,
): string | null {
  const seller = asRecord(asRecord(payload)?.seller);
  if (!seller) {
    return null;
  }

  const advertId = firstString(advert.id, advert.advert_id, advert.advertId);
  const linkedId = firstString(seller.advert_id, seller.advertId);

  if (advertId && linkedId && advertId !== linkedId) {
    return null;
  }

  return usableUserId(seller.user_id ?? seller.seller_id ?? seller.id);
}

/**
 * The seller a listing page names in its own metadata.
 *
 * One request, and the most direct answer there is: the canonical URL and the
 * JSON-LD/state of an advert page name the seller that posted it. Jiji's current
 * pages carry neither (`__NUXT_DATA__` is a devalue index table), so this is a
 * best-effort step before the advert endpoint — but it is the only source that
 * can answer when the advert endpoint is unavailable.
 */
async function sellerFromListingPage(
  target: Extract<JijiTarget, { kind: "listing" }>,
): Promise<SellerLookup | null> {
  const html = await jijiGetHtml(target.url);
  if (!html) {
    return null;
  }

  const [userId] = sellerIdsFromHtml(html, { advertGuid: target.guid });
  return userId ? { ok: true, userId } : null;
}

/**
 * The seller behind an advert, from Jiji's advert endpoint.
 *
 * The paths in `JIJI_ADVERT_API_PATHS` are tried in order and a 404 simply moves
 * on to the next one. A payload is only believed when it names the advert whose
 * guid we hold, so a stale or wrong path can never attribute a shop to another
 * seller. A timeout ends the attempt at once: more 15-second waits would only
 * delay the same answer.
 */
async function sellerFromAdvertApi(
  target: Extract<JijiTarget, { kind: "listing" }>,
): Promise<SellerLookup | null> {
  const wanted = target.guid.toLowerCase();

  for (const path of JIJI_ADVERT_API_PATHS) {
    const result = await jijiGetPage(
      jijiAdvertUrl(target.guid, path, target.host),
    );

    if (result.kind !== "page") {
      if (result.kind === "error" && result.result.status === 504) {
        return null;
      }
      continue;
    }

    const advert = findAdvertByGuid(result.payload, wanted);
    if (!advert) {
      continue;
    }

    const userId =
      advertUserId(advert) ?? envelopeSellerId(result.payload, advert);
    if (userId && isJijiUserId(userId)) {
      return { ok: true, userId };
    }
  }

  return null;
}

/**
 * Traces a listing link back to the seller who posted it.
 *
 * Three sources, cheapest and most reliable first:
 *
 * 1. Jiji's advert endpoint, matched on the guid (`sellerFromAdvertApi()`) — one
 *    small JSON request, and the source that works on Jiji's current pages;
 * 2. the advert page's own metadata (`sellerFromListingPage()`), for a page that
 *    publishes its seller in JSON-LD or its client state;
 * 3. Jiji's own search (`query` + `region_slug`, both taken from the pasted
 *    URL), which takes ~46,000 adverts down to a couple of pages; the advert
 *    guid then identifies the right row and its `user_id` is the seller.
 *
 * Five search pages is the ceiling: past that the query did not narrow, and
 * guessing from a weaker match would import someone else's catalogue.
 */
async function resolveListingSeller(
  target: Extract<JijiTarget, { kind: "listing" }>,
): Promise<SellerLookup> {
  const fromAdvert = await sellerFromAdvertApi(target);
  if (fromAdvert) {
    return fromAdvert;
  }

  const fromPage = await sellerFromListingPage(target);
  if (fromPage) {
    return fromPage;
  }

  const wanted = target.guid.toLowerCase();

  for (let page = 1; page <= JIJI_MAX_SEARCH_PAGES; page += 1) {
    const result = await jijiGetPage(
      jijiListingUrl(
        {
          query: target.query || undefined,
          region_slug: target.regionSlug,
          page,
        },
        target.host,
      ),
    );

    if (result.kind === "end") {
      break;
    }
    if (result.kind === "error") {
      return result.result;
    }

    const adverts = readAdverts(result.payload);

    for (const advert of adverts) {
      const matches =
        advertGuid(advert)?.toLowerCase() === wanted ||
        advertListingUrl(advert)?.toLowerCase().endsWith(`${wanted}.html`);

      if (!matches) {
        continue;
      }

      const userId = advertUserId(advert);
      if (userId && isJijiUserId(userId)) {
        return { ok: true, userId };
      }
    }

    if (adverts.length < JIJI_PAGE_SIZE) {
      break;
    }

    await sleep(JIJI_REQUEST_DELAY_MS);
  }

  return { ok: false, status: 404, error: JIJI_SHOP_UNRESOLVED_MESSAGE };
}

/**
 * Traces a shop page back to its seller.
 *
 * A `/sellerpage-<guid>` link names no numeric id in the URL, so the page is read
 * for one. Two sources, in order:
 *
 * 1. the page's own `<script>`/meta data (`sellerIdsFromHtml()`) — the id when
 *    the page publishes it;
 * 2. an advert link on the page, traced back through `resolveListingSeller()` —
 *    which is how Jiji's current Nuxt pages resolve, since their state is a
 *    devalue index table rather than readable `user_id` fields.
 *
 * When neither works the owner is told to paste a product link instead of being
 * left with an empty catalogue.
 */
async function resolveShopSeller(
  target: Extract<JijiTarget, { kind: "shop" }>,
): Promise<SellerLookup> {
  const pageUrl =
    target.url ??
    (target.handle ? `${jijiOrigin(target.host)}/${target.handle}` : null);

  if (!pageUrl) {
    return { ok: false, status: 400, error: JIJI_INVALID_TARGET_MESSAGE };
  }

  const html = await jijiGetHtml(pageUrl);
  if (!html) {
    return {
      ok: false,
      status: 502,
      error: JIJI_UNREACHABLE_MESSAGE,
      detail: "the shop page could not be read",
    };
  }

  const [userId] = sellerIdsFromHtml(html, { sellerGuid: target.sellerGuid });
  if (userId) {
    return { ok: true, userId };
  }

  const [href] = advertHrefsFromHtml(html);
  const listing = href
    ? parseJijiTarget(`${jijiOrigin(target.host)}${href}`)
    : null;

  if (!listing || listing.kind !== "listing") {
    return {
      ok: false,
      status: 404,
      error: JIJI_SHOP_UNRESOLVED_MESSAGE,
      detail: "the shop page carried no seller id and no listing link to follow",
    };
  }

  return resolveListingSeller(listing);
}

/** Turns any accepted input into the numeric seller id. */
async function resolveSellerId(target: JijiTarget): Promise<SellerLookup> {
  switch (target.kind) {
    case "user":
      return { ok: true, userId: target.userId };
    case "listing":
      return resolveListingSeller(target);
    case "shop":
      return resolveShopSeller(target);
  }
}


/**
 * Reads a seller's live listings straight from Jiji.
 *
 * The input is whatever the owner pasted: a product link, a shop link, or the
 * numeric seller id (`parseJijiTarget()` decides). Pages are read until the
 * endpoint answers 404 or returns a short page, and every page is checked with
 * `payloadIsTrusted()` before its adverts are kept — an ignored `user_id` returns
 * the whole marketplace, and that check is the only thing standing between it and
 * a tenant's catalogue.
 *
 * Demo fixtures are reachable only through `mockImportEnabled()` and are flagged
 * `mocked` so callers can label them; no failure path returns them.
 */
export async function fetchSellerListings(
  input: string,
): Promise<JijiListingsResult> {
  const target = parseJijiTarget(input);

  if (!target) {
    return { ok: false, status: 400, error: JIJI_INVALID_TARGET_MESSAGE };
  }

  if (mockImportEnabled()) {
    return {
      ok: true,
      listings: MOCK_LISTINGS,
      mocked: true,
      userId: null,
      sellerPageUrl: null,
    };
  }

  const seller = await resolveSellerId(target);
  if (!seller.ok) {
    return seller;
  }

  const userId = seller.userId;
  const listings: unknown[] = [];

  for (let page = 1; page <= JIJI_MAX_PAGES; page += 1) {
    const result = await jijiGetPage(
      jijiListingUrl({ user_id: userId, page }, target.host),
    );

    // Past the last page (or no such seller): nothing left to read.
    if (result.kind === "end") {
      break;
    }
    if (result.kind === "error") {
      return result.result;
    }

    if (!payloadIsTrusted(result.payload, userId)) {
      return {
        ok: false,
        status: 502,
        error: JIJI_UNREACHABLE_MESSAGE,
        detail: "Jiji did not confirm that the listings belong to that seller",
      };
    }

    const adverts = readAdverts(result.payload);
    listings.push(...adverts);

    if (adverts.length < JIJI_PAGE_SIZE || listings.length >= MAX_LISTINGS) {
      break;
    }

    await sleep(JIJI_REQUEST_DELAY_MS);
  }

  return {
    ok: true,
    listings: listings.slice(0, MAX_LISTINGS),
    mocked: false,
    userId,
    // Canonical form, on the seller's own country domain: the importer and the
    // sync job store this so the next run never traces a link again.
    sellerPageUrl: jijiSellerPageUrl(userId, target.host),
  };
}

