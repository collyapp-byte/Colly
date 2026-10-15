// Shared cart between /sales (list + cart) and /sales/quick (product picker).
//
// The cart is client-only UI state persisted to sessionStorage, so it survives
// navigation between the two surfaces but stays scoped to the current tab and
// is dropped when the tab closes. Nothing here touches localStorage (which
// would leak the cart across browser sessions) and nothing here hits an API —
// the routes and the products page are unchanged.

/**
 * A line in the cart. The `{ productId, name, price, image, quantity }` fields
 * are the catalogue-product shape; `id` gives React a stable key and
 * `productId === null` marks a productless "custom amount" line (added from the
 * cart panel's Custom Amount button on /sales).
 */
export type CartItem = {
  /** Stable line id: the product id for catalogue lines, generated for custom. */
  id: string;
  /** The catalogue product this line refers to, or null for a custom line. */
  productId: string | null;
  name: string;
  /** Unit amount in Naira. */
  price: number;
  image: string | null;
  quantity: number;
};

/** A product picked on /sales/quick, before it becomes a cart line. */
export type CartProduct = {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  /** Quantity picked on the picker. Defaults to 1 when omitted. */
  quantity?: number;
};

const CART_KEY = "colly.cart";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Defensive shape check. sessionStorage is shared across tabs and can be
 * written by hand, so anything unrecognised is dropped rather than trusted.
 */
function isCartItem(value: unknown): value is CartItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    (value.productId === null || typeof value.productId === "string") &&
    typeof value.name === "string" &&
    typeof value.price === "number" &&
    (value.image === null || typeof value.image === "string") &&
    typeof value.quantity === "number"
  );
}

/** Reads the cart. Returns [] on the server, when storage is disabled, or when the stored value is malformed. */
export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

/** Writes the cart. Storage failures are ignored — the in-memory cart still works for this page. */
export function setCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // Private mode / storage quota: keep the cart in memory only.
  }
}

/**
 * Merges picked products into the cart. A product already in the cart has its
 * quantity OVERWRITTEN (the picker is the source of truth for what it sends),
 * so picking 3× of an item and proceeding lands exactly 3 in the cart rather
 * than 3 plus whatever was already there.
 */
export function addToCart(products: CartProduct[]): void {
  if (products.length === 0) return;

  const next = getCart();

  for (const product of products) {
    const quantity = Math.min(
      Math.max(Math.trunc(product.quantity ?? 1), QUANTITY_MIN),
      QUANTITY_MAX,
    );
    const index = next.findIndex(
      (line) => line.productId === product.productId,
    );

    if (index === -1) {
      next.push({
        id: product.productId,
        productId: product.productId,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity,
      });
    } else {
      next[index] = { ...next[index], quantity };
    }
  }

  setCart(next);
}

/** Lowest and highest quantity a single line may hold. */
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 999;

/**
 * Sets one line's quantity, clamped to [QUANTITY_MIN, QUANTITY_MAX], persists it
 * and returns the new cart array so the caller can drop it straight into state.
 * Unknown ids are a no-op.
 */
export function setQuantity(id: string, quantity: number): CartItem[] {
  const clamped = Math.min(
    Math.max(Math.trunc(quantity), QUANTITY_MIN),
    QUANTITY_MAX,
  );
  const next = getCart().map((line) =>
    line.id === id ? { ...line, quantity: clamped } : line,
  );

  setCart(next);
  return next;
}

/** Clears the cart. */
export function clearCart(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(CART_KEY);
  } catch {
    // The cart simply lingers until the tab is closed.
  }
}
