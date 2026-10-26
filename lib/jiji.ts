// Jiji storefronts: scraping and mapping helpers.
//
// Both routes that talk to Jiji live on top of this module: the one-off importer
// (/api/products/import-jiji) copies a shop's catalogue into Colly, and the
// two-way sync (/api/products/sync-jiji) re-reads it later to follow price and
// availability changes. Route files cannot export helpers, so the scraper
// boundary lives here.

/** ReefAPI seller-listings endpoint (our Jiji scraper proxy). */
export const REEF_LISTINGS_URL = "https://api.reefapi.com/v1/jiji/seller_listings";

/** Reef calls can hang; fail before the owner's spinner outlives their patience. */
export const REEF_TIMEOUT_MS = 20_000;

/**
 * Per-run ceiling. A big shop keeps the request, the single insert and the
 * background embedding fan-out bounded; re-importing picks up the rest.
 */
export const MAX_LISTINGS = 500;

/** Value stored in `Product.externalSource` for listings that came from Jiji. */
export const JIJI_SOURCE = "JIJI";

/** Mock listing ids are prefixed so the sync job can tell them from real ones. */
export const MOCK_EXTERNAL_ID_PREFIX = "mock-";

/**
 * jiji.ng paths that are pages rather than seller handles, so pasting a search
 * or category URL fails with a clear message instead of importing nothing.
 */
const RESERVED_HANDLES = new Set([
  "about",
  "account",
  "adverts",
  "api",
  "blog",
  "c",
  "help",
  "login",
  "messages",
  "mobile",
  "my",
  "post-ad",
  "privacy",
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
 * Three fixed listings used when REEF_API_KEY is not configured yet. They run
 * through the same mapping and insert path as real data, so the Products page
 * can be tested end to end (button, loader, toast, refreshed list) today. The
 * `id`s are what the sync job matches on, so a mock shop syncs against itself.
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

export type ReefListingsResult =
  | { ok: true; listings: unknown[]; mocked: boolean }
  | { ok: false; status: number; error: string; detail?: string };

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
 * Placeholder id for a listing the scraper returned without one.
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

/**
 * Reads a price from a number, a display string ("₦1,200,000") or an object
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
 * Finds the listings array in a ReefAPI payload. The exact envelope is not
 * contractual, so the common shapes (`[...]`, `{ data: [...] }`,
 * `{ data: { listings: [...] } }`, `{ results: [...] }`) are all accepted.
 */
function pickListings(payload: unknown, depth = 0): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record || depth > 2) {
    return [];
  }

  const keys = ["listings", "products", "items", "results", "adverts", "data"];

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === "object") {
      const nested = pickListings(value, depth + 1);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

/**
 * The listing id as Jiji exposes it. ReefAPI is documented loosely, so the
 * common aliases are accepted, including a nested `advert` / `item` object.
 */
function readExternalId(record: Record<string, unknown>): string | null {
  const nested = asRecord(record.advert) ?? asRecord(record.item);

  const id = firstString(
    record.advertId,
    record.advert_id,
    record.id,
    record.uuid,
    record.itemId,
    nested?.advertId,
    nested?.id,
    nested?.uuid,
  );

  return id || null;
}

/** Maps one scraped listing onto the Product fields we store. */
export function mapListing(raw: unknown): MappedListing | null {
  const record = asRecord(raw);
  if (!record) {
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

  const price = parsePrice(
    record.price ??
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
 * Fetches a seller's live listings from ReefAPI.
 *
 * Without REEF_API_KEY the request is skipped and the mock listings are
 * returned, flagged as `mocked`, so a local clone can exercise the whole flow
 * (import, sync, dashboard card) without a scraper account.
 */
export async function fetchSellerListings(
  username: string,
): Promise<ReefListingsResult> {
  const apiKey = process.env.REEF_API_KEY?.trim();

  if (!apiKey) {
    return { ok: true, listings: MOCK_LISTINGS, mocked: true };
  }

  const endpoint = `${REEF_LISTINGS_URL}?username=${encodeURIComponent(username)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REEF_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404) {
      return {
        ok: false,
        status: 404,
        error:
          "We could not find that Jiji shop. Check the link and try again.",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        error: "Jiji is unavailable right now. Please try again later.",
        detail: `Reef API responded with HTTP ${response.status}`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        status: 502,
        error: "Jiji is unavailable right now. Please try again later.",
        detail: "Reef API returned invalid JSON",
      };
    }

    return { ok: true, listings: pickListings(payload), mocked: false };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        error: "Jiji took too long to respond. Please try again.",
      };
    }

    return {
      ok: false,
      status: 502,
      error: "Jiji is unavailable right now. Please try again later.",
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
