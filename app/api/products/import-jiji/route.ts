import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { reembedProduct } from "@/lib/embedding-pipeline";
import {
  JIJI_INVALID_TARGET_MESSAGE,
  JIJI_SOURCE,
  MAX_LISTINGS,
  asRecord,
  createExternalId,
  fetchSellerListings,
  firstString,
  mapListing,
  normalizeName,
  parseJijiTarget,
  type MappedListing,
} from "@/lib/jiji";

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

/**
 * Embeds freshly imported products after the response is on its way.
 *
 * Sequential on purpose: a 500-listing import would otherwise fire 500 Jina
 * requests at once. A failed embed only costs semantic search, never the import,
 * which is why every failure is logged and swallowed.
 */
function embedImportedProducts(ids: string[]): void {
  void (async () => {
    for (const id of ids) {
      try {
        await reembedProduct(id);
      } catch (error) {
        console.error(
          "[products/import-jiji] failed to embed product",
          id,
          error,
        );
      }
    }
  })();
}

// POST /api/products/import-jiji
// Body: { jijiUrl: string }
// Copies the seller's Jiji listings into the signed-in business's catalogue,
// skipping names it already sells. `jijiUrl` is whatever the owner pasted: a
// product link from their shop, their shop link, or their numeric seller id —
// `fetchSellerListings()` resolves all three against Jiji's public listing
// endpoint. Every row is tagged with externalSource "JIJI" and the listing's id,
// which is what /api/products/sync-jiji matches on later; a product that already
// exists by name is tagged in place instead of being duplicated.
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const jijiUrl = firstString(asRecord(body)?.jijiUrl);

    if (!jijiUrl) {
      return badRequest("Paste your Jiji shop or product link to continue.");
    }
    if (jijiUrl.length > 500) {
      return badRequest("That Jiji shop URL is too long.");
    }

    if (!parseJijiTarget(jijiUrl)) {
      return badRequest(JIJI_INVALID_TARGET_MESSAGE);
    }

    const result = await fetchSellerListings(jijiUrl);
    if (!result.ok) {
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

    if (result.mocked) {
      // Fixtures only reach here with JIJI_MOCK_IMPORT=1 on a dev server. Say so
      // in the log: these rows land in a real database.
      console.warn(
        "[products/import-jiji] inserting MOCK listings (JIJI_MOCK_IMPORT=1); these are not the seller's products",
      );
    }

    if (listings.length === 0) {
      return Response.json(
        { error: "We could not find any listings on that Jiji shop yet." },
        { status: 404 },
      );
    }

    // One read of the catalogue rather than a query per listing: imports touch
    // up to MAX_LISTINGS rows and the name set is small enough to hold.
    const existing = await prisma.product.findMany({
      where: { businessId },
      select: { id: true, name: true, externalSource: true },
    });

    const byName = new Map(
      existing.map((product) => [normalizeName(product.name), product]),
    );
    const taken = new Set(byName.keys());
    const rows: Array<MappedListing & { externalId: string }> = [];
    // Manually added / CSV products that match a listing by name are tagged in
    // place, so an existing shop upgrades to two-way sync without duplicates.
    const adoptions = new Map<string, string>();
    let skipped = 0;

    for (const listing of listings) {
      const key = normalizeName(listing.name);
      const externalId = listing.externalId ?? createExternalId();

      if (taken.has(key)) {
        const match = byName.get(key);
        if (match && !match.externalSource) {
          adoptions.set(match.id, externalId);
        } else {
          skipped += 1;
        }
        continue;
      }

      taken.add(key);
      rows.push({ ...listing, externalId });
    }

    // Remember the storefront for the sync job — in its canonical form once the
    // seller id is known, so a sync never has to trace a listing link again.
    // Saved even when every listing was already in the catalogue, so a re-import
    // just refreshes the link.
    await prisma.business.update({
      where: { id: businessId },
      data: {
        jijiShopUrl: result.userId
          ? `https://jiji.ng/sellerpage-${result.userId}`
          : jijiUrl,
      },
    });

    if (adoptions.size > 0) {
      await prisma.$transaction(
        [...adoptions].map(([id, externalId]) =>
          prisma.product.update({
            where: { id },
            data: { externalSource: JIJI_SOURCE, externalId },
          }),
        ),
      );
    }

    const created =
      rows.length === 0
        ? []
        : await prisma.product.createManyAndReturn({
            data: rows.map((row) => ({
              businessId,
              name: row.name,
              price: row.price,
              // Jiji does not expose per-listing stock, so the row starts
              // untracked (null = available until the sync sees it delisted).
              stock: null,
              description: row.description,
              images: row.images,
              externalSource: JIJI_SOURCE,
              externalId: row.externalId,
            })),
            select: { id: true },
          });

    embedImportedProducts(created.map((product) => product.id));

    return Response.json({
      success: true,
      // Everything now linked to Jiji: copied listings + products matched by
      // name that were tagged in place.
      count: created.length + adoptions.size,
      created: created.length,
      adopted: adoptions.size,
      skipped,
      mocked: result.mocked,
      sellerId: result.userId,
    });
  } catch (error) {
    console.error("[POST /api/products/import-jiji]", error);
    return Response.json(
      {
        error: "Failed to import products",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
