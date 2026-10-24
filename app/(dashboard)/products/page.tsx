"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Camera,
  CircleAlert,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Plus,
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
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
            onClick={() => setModal({ kind: "create" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
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
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add Product
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
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDelete(modal.product)}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-60"
            >
              {deleting && (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Delete
            </button>
          </div>
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
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
        title="Delete"
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-danger"
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
    <img
      src={image}
      alt={name}
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
