import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { serializeProduct } from "@/lib/products";
import { reembedProduct } from "@/lib/embedding-pipeline";

type ProductRequestBody = {
  name?: unknown;
  price?: unknown;
  floorPrice?: unknown;
  negotiable?: unknown;
  stock?: unknown;
  description?: unknown;
  images?: unknown;
  removeImage?: unknown;
};

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound() {
  return Response.json({ error: "Product not found" }, { status: 404 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

/**
 * Validates the `images` field into a list of URL strings.
 *
 * Returns null when the field is present but not an array of strings, so the
 * caller can respond with a 400.
 */
function readImages(value: unknown): string[] | null {
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

// PATCH /api/products/[id]
// Body: any subset of { name, price, stock, description }
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;
    const body = (await request.json()) as ProductRequestBody;

const data: {
      name?: string;
      price?: number;
      floorPrice?: number | null;
      negotiable?: boolean;
      stock?: number | null;
      description?: string | null;
      images?: string[];
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return badRequest("Product name cannot be empty");
      }
      data.name = body.name.trim();
    }

    if (body.price !== undefined) {
      if (
        typeof body.price !== "number" ||
        !Number.isFinite(body.price) ||
        body.price < 0
      ) {
        return badRequest("Price must be a number greater than or equal to 0");
      }
      data.price = body.price;
    }

    if (body.floorPrice !== undefined) {
      if (body.floorPrice === null || body.floorPrice === "") {
        // Clearing the floor means "never go below the list price".
        data.floorPrice = null;
      } else if (
        typeof body.floorPrice !== "number" ||
        !Number.isFinite(body.floorPrice) ||
        body.floorPrice < 0
      ) {
        return badRequest("Floor price must be a number greater than or equal to 0");
      } else {
        data.floorPrice = body.floorPrice;
      }
    }

    if (body.negotiable !== undefined) {
      if (typeof body.negotiable !== "boolean") {
        return badRequest("Negotiable must be a boolean");
      }
      data.negotiable = body.negotiable;
    }

    if (body.stock !== undefined) {
      if (body.stock === null || body.stock === "") {
        // Clearing stock marks the product as "not tracked".
        data.stock = null;
      } else if (
        typeof body.stock !== "number" ||
        !Number.isInteger(body.stock) ||
        body.stock < 0
      ) {
        return badRequest(
          "Stock must be a whole number greater than or equal to 0",
        );
      } else {
        data.stock = body.stock;
      }
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string") {
        return badRequest("Description must be text");
      }
      const trimmed = body.description.trim();
      if (!trimmed) {
        return badRequest("Description is required");
      }
      data.description = trimmed;
    }

    if (body.images !== undefined) {
      const images = readImages(body.images);
      if (images === null) {
        return badRequest("Images must be an array of URL strings");
      }
      data.images = images;
    }

    // removeImage is the single-URL alternative to sending a full replacement
    // list: it drops one image from whatever the product currently has.
    const removeImage =
      typeof body.removeImage === "string" ? body.removeImage.trim() : "";
    if (body.removeImage !== undefined && !removeImage) {
      return badRequest("removeImage must be a non-empty URL string");
    }

    if (Object.keys(data).length === 0 && !removeImage) {
      return badRequest("No valid fields provided");
    }

    // Scoped by businessId: a product belonging to another tenant reads as
    // "not found" rather than being editable.
    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) {
      return notFound();
    }

    // The floor must fit under the price that will be in effect after this
    // update (the new price when one is being changed, else the current one).
    if (data.floorPrice != null) {
      const effectivePrice = data.price ?? Number(existing.price);
      if (data.floorPrice > effectivePrice) {
        return badRequest("Floor price cannot be higher than the price");
      }
    }

    if (removeImage) {
      const base = data.images ?? existing.images;
      data.images = base.filter((url) => url !== removeImage);
    }

    const product = await prisma.product.update({ where: { id }, data });

    // Re-embed on every update so name/description changes stay searchable.
    void reembedProduct(product.id).catch((error) => {
      console.error("[embeddings] failed to embed product", product.id, error);
    });

    return Response.json({ product: serializeProduct(product) });
  } catch (error) {
    console.error("[PATCH /api/products/[id]]", error);
    return Response.json(
      {
        error: "Failed to update product",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) {
      return notFound();
    }

    await prisma.product.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[DELETE /api/products/[id]]", error);

    // Products referenced by a Sale cannot be deleted (FK restrict).
    if (message.includes("Foreign key constraint")) {
      return Response.json(
        { error: "This product is linked to existing sales and cannot be deleted." },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Failed to delete product", detail: message },
      { status: 500 },
    );
  }
}
