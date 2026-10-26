import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { serializeProduct } from "@/lib/products";
import { reembedProduct } from "@/lib/embedding-pipeline";
import {
  cursorDate,
  decodeCursor,
  encodeCursor,
  readPageSize,
} from "@/lib/pagination";

type ProductRequestBody = {
  name?: unknown;
  price?: unknown;
  floorPrice?: unknown;
  negotiable?: unknown;
  stock?: unknown;
  description?: unknown;
  images?: unknown;
};

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

/**
 * Validates the `images` field into a list of URL strings.
 *
 * Returns `[]` when the field is absent. Returns null when it is present but
 * not an array of strings, so callers can respond with a 400.
 */
function readImages(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const images: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    const trimmed = item.trim();
    if (trimmed) {
      images.push(trimmed);
    }
  }

  return images;
}

// GET /api/products?limit=50&cursor=...
// The signed-in business's products, newest first. Keyset paginated: pass
// `nextCursor` back as `cursor` for the following page.
export async function GET(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"));
    const cursorCreatedAt = cursorDate(cursor, "createdAt");
    const cursorId = cursor?.id ?? null;

    // Continue strictly after the last row of the previous page, matching the
    // (createdAt, id) ordering (id breaks ties on rows created in the same ms).
    const after =
      cursorCreatedAt && cursorId
        ? {
            OR: [
              { createdAt: { lt: cursorCreatedAt } },
              { createdAt: cursorCreatedAt, id: { lt: cursorId } },
            ],
          }
        : {};

    // Newest first: `take` without an order would silently slice the oldest
    // rows, and a freshly added product must stay visible.
    const products = await prisma.product.findMany({
      where: { businessId, ...after },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });

    const lastProduct = products.at(-1);
    const nextCursor =
      products.length === limit && lastProduct
        ? encodeCursor({ createdAt: lastProduct.createdAt, id: lastProduct.id })
        : null;

    return Response.json({
      products: products.map(serializeProduct),
      nextCursor,
    });
  } catch (error) {
    console.error("[GET /api/products]", error);
    return Response.json(
      {
        error: "Failed to load products",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST /api/products
// Body: { name: string, price: number, stock: number, description?: string }
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const body = (await request.json()) as ProductRequestBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    if (!name) {
      return badRequest("Product name is required");
    }
    if (!description) {
      return badRequest("Description is required");
    }
    if (
      typeof body.price !== "number" ||
      !Number.isFinite(body.price) ||
      body.price < 0
    ) {
      return badRequest("Price must be a number greater than or equal to 0");
    }

    // Floor price is optional: absent, null or empty means "no floor" (null).
    let floorPrice: number | null = null;
    if (body.floorPrice !== undefined && body.floorPrice !== null && body.floorPrice !== "") {
      if (
        typeof body.floorPrice !== "number" ||
        !Number.isFinite(body.floorPrice) ||
        body.floorPrice < 0
      ) {
        return badRequest("Floor price must be a number greater than or equal to 0");
      }
      if (body.floorPrice > body.price) {
        return badRequest("Floor price cannot be higher than the price");
      }
      floorPrice = body.floorPrice;
    }

    // Negotiable defaults to false when the field is absent.
    let negotiable = false;
    if (body.negotiable !== undefined) {
      if (typeof body.negotiable !== "boolean") {
        return badRequest("Negotiable must be a boolean");
      }
      negotiable = body.negotiable;
    }

    // Stock is optional: absent, null or empty means "not tracked" (null).
    let stock: number | null = null;
    if (body.stock !== undefined && body.stock !== null && body.stock !== "") {
      if (
        typeof body.stock !== "number" ||
        !Number.isInteger(body.stock) ||
        body.stock < 0
      ) {
        return badRequest("Stock must be a whole number greater than or equal to 0");
      }
      stock = body.stock;
    }

    const images = readImages(body.images);
    if (images === null) {
      return badRequest("Images must be an array of URL strings");
    }

    const product = await prisma.product.create({
      data: {
        businessId,
        name,
        price: body.price,
        floorPrice,
        negotiable,
        stock,
        description: description || null,
        images,
      },
    });

    // Embed for semantic search without making the owner wait on Jina.
    void reembedProduct(product.id).catch((error) => {
      console.error("[embeddings] failed to embed product", product.id, error);
    });

    return Response.json({ product: serializeProduct(product) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/products]", error);
    return Response.json(
      {
        error: "Failed to create product",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
