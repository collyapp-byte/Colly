"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Camera,
  CircleAlert,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Store,
  Trash,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { BackButton } from "@/components/ui/back-button";
import { ProductFormModal } from "@/components/products/product-form-modal";
import { StockBadge } from "@/components/products/stock-badge";
import { formatNaira } from "@/lib/format";
import type { Product, ProductInput } from "@/lib/products";

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; product: Product }
  | { kind: "delete"; product: Product };

const QUICK_START_STEPS = [
  'Click "Add Product".',
  'Enter the Name and Price (e.g. "iPhone 15", "₦1,200,000").',
  "Write a short description of the features.",
  "Upload a clear picture of the product.",
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [importing, setImporting] = useState(false);
  // Jiji import keeps its own modal state so it never clashes with the
  // create / edit / delete dialog that `modal` tracks.
  const [jijiOpen, setJijiOpen] = useState(false);
  const [jijiUrl, setJijiUrl] = useState("");
  const [jijiImporting, setJijiImporting] = useState(false);
  const [jijiError, setJijiError] = useState<string | null>(null);
  // Two-way sync runs next to the importer: it follows price + sold changes
  // from the shop saved at import time.
  const [syncingJiji, setSyncingJiji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { products: Product[] } = await res.json();
        if (active) {
          setProducts(data.products);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  /** Re-fetches the list after a create / update / delete. */
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const closeModal = useCallback(() => setModal({ kind: "closed" }), []);

  function openJijiImport() {
    setJijiError(null);
    setJijiOpen(true);
  }

  function closeJijiImport() {
    // Stay open while the request is in flight; the import finishes into the
    // refreshed list either way.
    if (jijiImporting) return;
    setJijiOpen(false);
    setJijiError(null);
  }

  async function handleJijiImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (jijiImporting) return;

    const shopUrl = jijiUrl.trim();
    if (!shopUrl) {
      setJijiError("Paste your Jiji shop or product link to continue.");
      return;
    }

    setJijiImporting(true);
    setJijiError(null);

    try {
      const res = await fetch("/api/products/import-jiji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jijiUrl: shopUrl }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        count?: number;
        created?: number;
        adopted?: number;
        mocked?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to import products");
      }

      if (data.mocked) {
        // Only reachable with JIJI_MOCK_IMPORT=1 on a dev server, but say it out
        // loud: these rows are fixtures, not the seller's shop.
        toast.warning(
          `Demo mode: added ${data.count ?? 0} sample products. These are not your Jiji listings.`,
        );
      } else {
        toast.success(
          `Successfully imported ${data.count ?? 0} products from Jiji!`,
        );
      }
      setJijiOpen(false);
      setJijiUrl("");
      refresh();
    } catch (err) {
      // The API explains 4xx/5xx cases far better than a generic toast ("that is
      // not a Jiji shop or product link", "couldn't read that shop from Jiji"), so
      // the same sentence goes to the toast and to the dialog.
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to import products. Check the URL and try again.";
      toast.error(message);
      setJijiError(message);
    } finally {
      setJijiImporting(false);
    }
  }

  /**
   * Reconciles the catalogue with the live Jiji shop. `refresh()` afterwards so
   * the prices / stock badges in the list match what the sync just wrote.
   */
  async function handleJijiSync() {
    if (syncingJiji) return;

    setSyncingJiji(true);
    try {
      const res = await fetch("/api/products/sync-jiji", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        markedOutOfStock?: number;
        priceUpdates?: number;
        error?: string;
      } | null;

      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to sync with Jiji");
      }

      toast.success(
        `Synced! Marked ${data.markedOutOfStock ?? 0} products out of stock and updated ${data.priceUpdates ?? 0} prices.`,
      );
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync with Jiji");
    } finally {
      setSyncingJiji(false);
    }
  }

  async function handleCreate(values: ProductInput) {
    const duplicate = products?.some(
      (product) =>
        product.name.trim().toLowerCase() === values.name.trim().toLowerCase(),
    );
    if (duplicate) {
      toast.error("A product with this name already exists. Are you sure?");
      throw new Error("A product with this name already exists.");
    }

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create product");
    }

    refresh();
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as {
        imported?: number;
        duplicates?: number;
        errors?: number;
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to import products");
      }

      toast.success(
        `Imported ${data?.imported ?? 0} products. Skipped ${data?.duplicates ?? 0} duplicates.`,
      );
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import products",
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleUpdate(id: string, values: ProductInput) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to update product");
    }

    refresh();
  }

  async function handleDelete(product: Product) {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete product");
      }

      setModal({ kind: "closed" });
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  function openDelete(product: Product) {
    setDeleteError(null);
    setModal({ kind: "delete", product });
  }

  const loading = products === null && error === null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackButton />
          <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
            Products
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your catalogue. Colly uses these details to answer customer questions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden
              />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            {importing ? "Importing..." : "Import CSV"}
          </button>
          <button
            type="button"
            onClick={openJijiImport}
            disabled={jijiImporting}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Store className="h-4 w-4" aria-hidden />
            Import from Jiji
          </button>
          <button
            type="button"
            onClick={handleJijiSync}
            disabled={syncingJiji}
            title="Pull price changes and sold listings from Jiji"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncingJiji ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            {syncingJiji ? "Syncing..." : "Sync Jiji"}
          </button>
          <button
            type="button"
            onClick={() => setModal({ kind: "create" })}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add Product
          </button>
        </div>
      </div>

      {loading && <ProductSkeleton />}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Could not load products</p>
            <p className="text-danger/80">{error}</p>
          </div>
        </div>
      )}

      {products && products.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-surface p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <h2 className="font-display text-xl text-gray-900 sm:text-2xl">
                Your AI needs a catalogue to sell.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-gray-500">
                Add your products here so Colly can quote prices, describe
                features, and send pictures to customers automatically.
              </p>

              <ol className="mt-5 space-y-3">
                {QUICK_START_STEPS.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-start gap-3 text-sm text-gray-700"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF4EC] text-xs font-semibold text-[#FF6600]">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setModal({ kind: "create" })}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add Product
                </button>
                <button
                  type="button"
                  onClick={openJijiImport}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Store className="h-4 w-4" aria-hidden />
                  Import from Jiji
                </button>
              </div>
            </div>

            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4">
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100 text-gray-300">
                  <Camera className="h-10 w-10" aria-hidden />
                </div>
                <div className="mt-3 h-3 w-3/4 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-1/3 rounded bg-gray-200" />
                <div className="mt-3 h-2 w-full rounded bg-gray-100" />
                <div className="mt-1.5 h-2 w-5/6 rounded bg-gray-100" />
              </div>
            </div>
          </div>
        </div>
      )}

      {products && products.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-surface md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th scope="col" className="px-6 py-3 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Price
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Stock
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <ProductThumb
                          image={product.images[0]}
                          name={product.name}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {product.name}
                          </p>
                          {product.description && (
                            <p className="mt-0.5 max-w-md truncate text-xs text-gray-500">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {formatNaira(product.price)}
                    </td>
                    <td className="px-6 py-4">
                      <StockBadge stock={product.stock} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <ActionButtons
                          name={product.name}
                          onEdit={() => setModal({ kind: "edit", product })}
                          onDelete={() => openDelete(product)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {products.map((product) => (
              <li
                key={product.id}
                className="rounded-lg border border-gray-200 bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductThumb
                      image={product.images[0]}
                      name={product.name}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <StockBadge stock={product.stock} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="font-display text-lg text-gray-900">
                    {formatNaira(product.price)}
                  </p>
                  <ActionButtons
                    name={product.name}
                    onEdit={() => setModal({ kind: "edit", product })}
                    onDelete={() => openDelete(product)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {modal.kind === "create" && (
        <ProductFormModal
          mode="create"
          onClose={closeModal}
          onSubmit={handleCreate}
        />
      )}

      {modal.kind === "edit" && (
        <ProductFormModal
          mode="edit"
          product={modal.product}
          onClose={closeModal}
          onSubmit={(values) => handleUpdate(modal.product.id, values)}
        />
      )}

      {modal.kind === "delete" && (
        <Modal title="Delete product" onClose={closeModal}>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900">
              {modal.product.name}
            </span>
            ? This cannot be undone.
          </p>

          {deleteError && (
            <p className="mt-3 text-sm text-danger">{deleteError}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={deleting}
              className="inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDelete(modal.product)}
              disabled={deleting}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-60"
            >
              {deleting && (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Delete
            </button>
          </div>
        </Modal>
      )}

      {jijiOpen && (
        <Modal
          title="Import from Jiji"
          onClose={closeJijiImport}
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeJijiImport}
                disabled={jijiImporting}
                className="inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="jiji-import-form"
                disabled={jijiImporting}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-colly px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {jijiImporting && (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                )}
                {jijiImporting ? "Importing..." : "Import products"}
              </button>
            </div>
          }
        >
          <form id="jiji-import-form" onSubmit={handleJijiImport}>
            <label
              htmlFor="jiji-shop-url"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Jiji shop or product link
            </label>
            <input
              id="jiji-shop-url"
              type="text"
              inputMode="url"
              value={jijiUrl}
              onChange={(event) => setJijiUrl(event.target.value)}
              placeholder="https://jiji.ng/lagos/mobile-phones/iphone-11-64gb-hdOZhLA7u0r6u5lqZ1gOJhn0.html"
              disabled={jijiImporting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-2 text-xs text-gray-500">
              Paste any product link from your shop (it ends in .html) or your
              shop link. We copy the title, price, description and first photo
              from each listing. Products you already have with the same name are
              skipped.
            </p>

            {jijiError && (
              <p className="mt-3 text-sm text-danger">{jijiError}</p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

type ActionButtonsProps = {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
};

function ActionButtons({ name, onEdit, onDelete }: ActionButtonsProps) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${name}`}
        title="Edit"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
        title="Delete"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-danger"
      >
        <Trash className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

type ThumbProps = {
  image?: string;
  name: string;
};

function ProductThumb({ image, name }: ThumbProps) {
  if (!image) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
        <ImageIcon className="h-4 w-4" aria-hidden />
      </div>
    );
  }

  return (
    // Catalogue images are whatever the seller supplied: our Supabase Storage
    // bucket for uploads, but the Jiji importer keeps the listing's third-party
    // CDN URL (`lib/jiji.ts#readImageUrl`), which no `images.remotePatterns`
    // allow-list can cover. That rules out `next/image` for this thumbnail, so
    // the plain element carries the same guarantees by hand: explicit
    // dimensions (no layout shift) and lazy decoding (a 50-row table must not
    // fetch 50 images up front).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={name}
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
    />
  );
}

function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-surface">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-b-0"
        >
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
