// Shared types for the product catalogue.

/** A product as sent to / received from the API (price is a plain number). */
export type Product = {
  id: string;
  name: string;
  price: number;
  floorPrice: number | null;
  negotiable: boolean;
  stock: number | null;
  description: string | null;
  details: string | null;
  images: string[];
  createdAt: string;
};

/** The editable fields of a product. */
export type ProductInput = {
  name: string;
  price: number;
  floorPrice?: number | null;
  negotiable?: boolean;
  stock?: number | null;
  description: string;
  details?: string;
  images: string[];
};

/**
 * Shape of a Product row as returned by Prisma. `price` and `floorPrice` are
 * Decimals there, so they are intentionally left loose and normalised by
 * `serializeProduct`.
 */
export type ProductRecord = {
  id: string;
  name: string;
  price: unknown;
  floorPrice?: unknown;
  negotiable?: boolean | null;
  stock: number | null;
  description: string | null;
  details: string | null;
  images: string[];
  createdAt: Date;
};

/** Converts a Prisma Product row into the JSON-friendly `Product` shape. */
export function serializeProduct(product: ProductRecord): Product {
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    floorPrice:
      product.floorPrice === undefined || product.floorPrice === null
        ? null
        : Number(product.floorPrice),
    // Rows created before the column existed read as null; those products are
    // negotiable (the DB default).
    negotiable: product.negotiable ?? true,
    stock: product.stock,
    description: product.description,
    details: product.details,
    images: product.images ?? [],
    createdAt: new Date(product.createdAt).toISOString(),
  };
}
