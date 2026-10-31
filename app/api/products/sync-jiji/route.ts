import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import {
  JIJI_FETCH_FAILED_MESSAGE,
  JIJI_SOURCE,
  MAX_LISTINGS,
  MOCK_EXTERNAL_ID_PREFIX,
  asRecord,
  fetchSellerListings,
  firstString,
  mapListing,
  normalizeName,
  parseJijiTarget,
  type JijiListingsResult,
  type MappedListing,
} from "@/lib/jiji";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

/**
 * 422: this shop is known and the link is valid, but Jiji could not be read.
 *
 * The same answer the importer gives — a blocked, reset, timed-out or 5xx Jiji
 * is a failed dependency, not a failed request, and never a status that reads as
 * our own gateway falling over.
 */
function jijiUnavailable() {
  return Response.json({ error: JIJI_FETCH_FAILED_MESSAGE }, { status: 422 });
}

/** Writes are grouped so a large catalogue never becomes one huge transaction. */
const WRITE_CHUNK_SIZE = 100;

/** A catalogue row as the sync needs it: identity, price and Jiji listing id. */
type TrackedProduct = {
  id: string;
  name: string;
  price: unknown;
  floorPrice: unknown;
  stock: number | null;
  externalId: string | null;
};

type PriceUpdate = {
  id: string;
  price: number;
  /** Set only when the stored floor would sit above the new list price. */
  floorPrice?: number;
};

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET /api/products/sync-jiji
// Status for the dashboard card: when this shop was last synced, and whether
// the business has any Jiji products to sync at all.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const [business, jijiProductCount] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { lastJijiSyncAt: true, jijiShopUrl: true },
      }),
      prisma.product.count({
        where: { businessId, externalSource: JIJI_SOURCE },
      }),
    ]);

    return Response.json({
      lastJijiSyncAt: business?.lastJijiSyncAt
        ? business.lastJijiSyncAt.toISOString()
        : null,
      jijiShopUrl: business?.jijiShopUrl ?? null,
      jijiProductCount,
      hasJijiProducts: jijiProductCount > 0,
    });
  } catch (error) {
    console.error("[GET /api/products/sync-jiji]", error);
    return Response.json(
      { error: "Failed to load the Jiji sync status", detail: detailOf(error) },
      { status: 500 },
    );
  }
}

// POST /api/products/sync-jiji
// Body (optional): { jijiUrl?: string }
//
// Two-way sync: re-reads the shop saved at import time and reconciles the
// catalogue with the live listings. Listings that disappeared are marked out of
// stock, changed prices are copied across (clamping the negotiating floor when
// it would end up above the new price), and Business.lastJijiSyncAt is stamped.
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { jijiShopUrl: true },
    });

    if (!business) {
      return unauthorized();
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const providedUrl = firstString(asRecord(body)?.jijiUrl);
    const shopUrl = providedUrl || business.jijiShopUrl || "";

    if (!shopUrl) {
      return Response.json(
        { error: "Import your Jiji shop first so we know which shop to sync." },
        { status: 400 },
      );
    }

    if (!parseJijiTarget(shopUrl)) {
      return Response.json(
        {
          error:
            "The saved Jiji shop link is not valid. Import your shop again.",
        },
        { status: 400 },
      );
    }

    const products: TrackedProduct[] = await prisma.product.findMany({
      where: { businessId, externalSource: JIJI_SOURCE },
      select: {
        id: true,
        name: true,
        price: true,
        floorPrice: true,
        stock: true,
        externalId: true,
      },
    });

    if (products.length === 0) {
      return Response.json(
        { error: "No Jiji products to sync yet. Import your Jiji shop first." },
        { status: 409 },
      );
    }

    let result: JijiListingsResult;

    try {
      result = await fetchSellerListings(shopUrl);
    } catch (error) {
      // An exception escaping the handler is served as a bodiless 502; the owner
      // gets one sentence instead, and nothing in the catalogue is touched.
      console.error("[products/sync-jiji] Jiji request failed", error);
      return jijiUnavailable();
    }

    if (!result.ok) {
      // Anything the upstream got wrong (blocked, reset, unreadable body) is a
      // failed dependency: 422, never a 5xx that looks like our own outage.
      if (result.status >= 500) {
        console.warn(
          "[products/sync-jiji] Jiji could not be read",
          result.detail ?? result.error,
        );
        return jijiUnavailable();
      }

      return Response.json(
        result.detail
          ? { error: result.error, detail: result.detail }
          : { error: result.error },
        { status: result.status },
      );
    }

    const listings: MappedListing[] = [];
    for (const raw of result.listings) {
      if (listings.length >= MAX_LISTINGS) {
        break;
      }
      const listing = mapListing(raw);
      if (listing) {
        listings.push(listing);
      }
    }

    // An empty payload would mark the whole catalogue out of stock; treat it as
    // a Jiji hiccup and change nothing.
    if (listings.length === 0) {
      console.warn("[products/sync-jiji] Jiji returned no listings; nothing changed");
      return jijiUnavailable();
    }

    // A mock payload only knows mock-* ids. If the catalogue holds real Jiji
    // ids, this run would wipe them out - refuse instead of corrupting stock.
    if (result.mocked) {
      const hasRealIds = products.some(
        (product) =>
          product.externalId &&
          !product.externalId.startsWith(MOCK_EXTERNAL_ID_PREFIX),
      );

      if (hasRealIds) {
        return Response.json(
          {
            error:
              "Demo mode is on, so this sync cannot refresh real Jiji listings. Turn off JIJI_MOCK_IMPORT and try again.",
          },
          { status: 503 },
        );
      }
    }

    const liveById = new Map<string, MappedListing>();
    const liveByName = new Map<string, MappedListing>();
    for (const listing of listings) {
      if (listing.externalId) {
        liveById.set(listing.externalId, listing);
      }
      liveByName.set(normalizeName(listing.name), listing);
    }

    const outOfStockIds: string[] = [];
    const priceUpdates: PriceUpdate[] = [];

    for (const product of products) {
      // Rows with no id cannot be matched to a listing. Guessing would mark live
      // products out of stock, so they wait for the next import to tag them.
      if (!product.externalId) {
        continue;
      }

      // Name is the fallback: an id the payload omitted on import may come back
      // as a different placeholder, but the listing title still matches.
      const live =
        liveById.get(product.externalId) ??
        liveByName.get(normalizeName(product.name));

      if (!live) {
        // Already out of stock means nothing to write and nothing to report.
        if (product.stock !== 0) {
          outOfStockIds.push(product.id);
        }
        continue;
      }

      const current = Number(product.price);
      if (!Number.isFinite(current) || Math.abs(current - live.price) < 0.005) {
        continue;
      }

      const floor =
        product.floorPrice === null ? null : Number(product.floorPrice);
      const update: PriceUpdate = { id: product.id, price: live.price };

      // A price drop must not leave the AI free to accept an offer above the new
      // list price, so the floor is pulled down with it.
      if (floor !== null && Number.isFinite(floor) && floor > live.price) {
        update.floorPrice = live.price;
      }

      priceUpdates.push(update);
    }

    const writes = [
      ...outOfStockIds.map((id) =>
        prisma.product.update({ where: { id }, data: { stock: 0 } }),
      ),
      ...priceUpdates.map((update) =>
        prisma.product.update({
          where: { id: update.id },
          data:
            update.floorPrice === undefined
              ? { price: update.price }
              : { price: update.price, floorPrice: update.floorPrice },
        }),
      ),
    ];

    for (let index = 0; index < writes.length; index += WRITE_CHUNK_SIZE) {
      await prisma.$transaction(writes.slice(index, index + WRITE_CHUNK_SIZE));
    }

    const syncedAt = new Date();

    await prisma.business.update({
      where: { id: businessId },
      data: {
        lastJijiSyncAt: syncedAt,
        // Only written when a caller supplies a shop link; the dashboard and
        // Products page sync the storefront saved by the importer. Stored in its
        // canonical form so the next sync reads the seller id straight away.
        ...(providedUrl
          ? {
              jijiShopUrl: result.sellerPageUrl ?? providedUrl,
            }
          : {}),
      },
    });

    return Response.json({
      success: true,
      markedOutOfStock: outOfStockIds.length,
      priceUpdates: priceUpdates.length,
      checked: products.length,
      mocked: result.mocked,
      syncedAt: syncedAt.toISOString(),
    });
  } catch (error) {
    console.error("[POST /api/products/sync-jiji]", error);
    return Response.json(
      { error: "Failed to sync with Jiji", detail: detailOf(error) },
      { status: 500 },
    );
  }
}
