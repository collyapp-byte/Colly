const BASE =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap";

/**
 * Stock level badge. null means stock is not tracked, so the product counts as
 * available. 0 is out of stock, 1-10 is low and anything above 10 is in stock.
 * Exact quantities are never shown.
 */
export function StockBadge({ stock }: { stock: number | null }) {
  if (stock === null) {
    return <span className={`${BASE} bg-gray-100 text-gray-600`}>Available</span>;
  }

  if (stock === 0) {
    return <span className={`${BASE} bg-red-100 text-red-700`}>Out of Stock</span>;
  }

  const styles =
    stock > 10 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";

  return <span className={`${BASE} ${styles}`}>{stock > 10 ? "In Stock" : "Low Stock"}</span>;
}
