"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleAlert, ImageIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityControl } from "@/components/ui/quantity-control";
import { formatNaira } from "@/lib/format";
import { addToCart, type CartProduct } from "@/lib/cart-storage";
import type { Product } from "@/lib/products";

export default function QuickSalePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let active = true;

    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((data: { products?: Product[] }) => {
        if (active) {
          setProducts(data.products ?? []);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Something went wrong",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const searchTerm = search.trim().toLowerCase();
  const filteredProducts = useMemo(
    () =>
      (products ?? []).filter((product) =>
        product.name.toLowerCase().includes(searchTerm),
      ),
    [products, searchTerm],
  );

  const totalItems = useMemo(
    () => Array.from(quantities.values()).reduce((sum, qty) => sum + qty, 0),
    [quantities],
  );
  const loading = products === null && error === null;

  function setQty(productId: string, qty: number) {
    setQuantities((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(productId);
      else next.set(productId, Math.min(999, qty));
      return next;
    });
  }

  function handleProceed() {
    const items: CartProduct[] = (products ?? [])
      .filter((p) => quantities.has(p.id))
      .map((p) => ({
        productId: p.id,
        name: p.name,
        price: p.price,
        image: p.images[0] ?? null,
        quantity: quantities.get(p.id) ?? 1,
      }));

    if (items.length === 0) return;

    addToCart(items);
    // Selection is deliberately local and is dropped on unmount, so returning
    // to this page always starts from a clean slate.
    setQuantities(new Map());
    router.push("/sales");
  }

  return (
    <div className="w-full pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/sales"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-colly transition-colors hover:text-colly-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Sales
          </Link>
          <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
            Quick Sale
          </h1>
        </div>

        {/* Desktop: proceed lives top-right */}
        <div className="hidden lg:block">
          <ProceedButton count={totalItems} onProceed={handleProceed} />
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
          aria-label="Search products"
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20"
        />
      </div>

      {/* Selection summary */}
      {totalItems > 0 && (
        <p className="mt-3 text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{totalItems}</span>{" "}
          item{totalItems === 1 ? "" : "s"} in cart
        </p>
      )}

      {loading && <ProductGridSkeleton />}

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Could not load products</p>
            <p className="text-danger/80">{error}</p>
          </div>
        </div>
      )}

      {products && filteredProducts.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-surface p-10 text-center">
          <p className="text-sm text-gray-500">
            {searchTerm ? (
              "No products match your search."
            ) : (
              <>
                No products yet.{" "}
                <Link
                  href="/products"
                  className="font-semibold text-colly transition-colors hover:text-colly-hover"
                >
                  Add products from the Products page.
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {filteredProducts.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {filteredProducts.map((product) => (
            <SelectableProductCard
              key={product.id}
              product={product}
              quantity={quantities.get(product.id) ?? 0}
              onSetQuantity={(qty) => setQty(product.id, qty)}
            />
          ))}
        </div>
      )}

      {/* Mobile: proceed sticks to the bottom */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] lg:hidden">
        <ProceedButton
          count={totalItems}
          onProceed={handleProceed}
          fullWidth
        />
      </div>
    </div>
  );
}

type ProceedButtonProps = {
  count: number;
  onProceed: () => void;
  fullWidth?: boolean;
};

function ProceedButton({ count, onProceed, fullWidth }: ProceedButtonProps) {
  const disabled = count === 0;

  return (
    <Button
      type="button"
      variant={disabled ? "secondary" : "primary"}
      disabled={disabled}
      onClick={onProceed}
      className={`${fullWidth ? "w-full" : ""} ${
        disabled ? "" : "shadow-md"
      }`}
    >
      Proceed with {count} item{count === 1 ? "" : "s"} →
    </Button>
  );
}

type SelectableProductCardProps = {
  product: Product;
  quantity: number;
  onSetQuantity: (quantity: number) => void;
};

function SelectableProductCard({
  product,
  quantity,
  onSetQuantity,
}: SelectableProductCardProps) {
  const outOfStock = product.stock === 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-surface transition-all hover:border-colly hover:ring-1 hover:ring-colly/30">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ImageIcon className="h-7 w-7" aria-hidden />
          </div>
        )}

        {outOfStock && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2 md:p-2.5">
        <p className="line-clamp-2 text-[12.5px] font-medium text-gray-900">
          {product.name}
        </p>
        <p className="mt-0.5 text-[12.5px] font-semibold text-[#FF6600]">
          {formatNaira(product.price)}
        </p>
        <div className="mt-2">
          {quantity > 0 ? (
            <QuantityControl
              quantity={quantity}
              minQuantity={1}
              onRemove={() => onSetQuantity(0)}
              onChange={(n) => onSetQuantity(n)}
            />
          ) : (
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onSetQuantity(1)}
              className="w-full rounded-md border border-dashed border-gray-300 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:border-colly hover:text-colly disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((card) => (
        <div
          key={card}
          className="overflow-hidden rounded-lg border border-gray-200 bg-surface"
        >
          <div className="aspect-[4/3] w-full animate-pulse bg-gray-100" />
          <div className="space-y-2 p-2 md:p-2.5">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
