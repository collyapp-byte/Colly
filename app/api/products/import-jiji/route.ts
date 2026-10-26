import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { reembedProduct } from "@/lib/embedding-pipeline";
import {
  JIJI_SOURCE,
  MAX_LISTINGS,
  asRecord,
  createExternalId,
  extractJijiUsername,
  fetchSellerListings,
  firstString,
  mapListing,
  normalizeName,
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
// skipping names it already sells. Every row is tagged with externalSource
// "JIJI" and the listing's id, which is what /api/products/sync-jiji matches on
// later; a product that already exists by name is tagged in place instead of
// being duplicated.
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const jijiUrl = firstString(asRecord(body)?.jijiUrl);

    if (!jijiUrl) {
      return badRequest("Paste your Jiji shop URL to continue.");
    }
    if (jijiUrl.length > 500) {
      return badRequest("That Jiji shop URL is too long.");
    }

    const username = extractJijiUsername(jijiUrl);
    if (!username) {
      return badRequest(
        "That does not look like a Jiji shop link. Copy the URL from your shop page (for example https://jiji.ng/your-shop-name).",
      );
    }

    const result = await fetchSellerListings(username);
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

    // Remember the storefront for the sync job. Saved even when every listing
    // was already in the catalogue, so a re-import just refreshes the link.
    await prisma.business.update({
      where: { id: businessId },
      data: { jijiShopUrl: jijiUrl },
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
      username,
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
