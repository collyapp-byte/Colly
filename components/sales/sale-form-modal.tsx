"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";
import type { Product } from "@/lib/products";

export const SALE_STATUSES = ["paid", "pending", "cancelled"] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

export type SaleInput = {
  customerId: string;
  productId: string;
  quantity: number;
  status: SaleStatus;
};

type SaleOption = {
  id: string;
  name: string;
};

type LoadState = "loading" | "loaded" | "error";

type SaleRecord = {
  id: string;
  customer: SaleOption;
  /** null for a productless "custom amount" line. */
  product: SaleOption | null;
  quantity: number;
  status: SaleStatus;
  customLabel?: string | null;
  totalAmount?: number;
};

type SaleFormModalProps = {
  mode: "create" | "edit";
  sale?: SaleRecord;
  onClose: () => void;
  /** Should throw with a message when the save fails. */
  onSubmit: (values: SaleInput) => Promise<void>;
};

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

const STATUS_LABELS: Record<SaleStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  cancelled: "Cancelled",
};

export function SaleFormModal({
  mode,
  sale,
  onClose,
  onSubmit,
}: SaleFormModalProps) {
  const [customers, setCustomers] = useState<SaleOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customersState, setCustomersState] = useState<LoadState>("loading");
  const [productsState, setProductsState] = useState<LoadState>("loading");
  const [customerId, setCustomerId] = useState(sale?.customer.id ?? "");
  const [productId, setProductId] = useState(sale?.product?.id ?? "");
  const [quantity, setQuantity] = useState(
    sale ? String(sale.quantity) : "1",
  );
  const [status, setStatus] = useState<SaleStatus>(sale?.status ?? "paid");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(() => {
    fetch("/api/customers")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((data: { customers?: SaleOption[] }) => {
        setCustomers(data.customers ?? []);
        setCustomersState("loaded");
      })
      .catch((err: unknown) => {
        console.error("[sale-form] customers load failed:", err);
        setCustomersState("error");
      });
  }, []);

  const loadProducts = useCallback(() => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((data: { products?: Product[] }) => {
        setProducts(data.products ?? []);
        setProductsState("loaded");
      })
      .catch((err: unknown) => {
        console.error("[sale-form] products load failed:", err);
        setProductsState("error");
      });
  }, []);

  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, [loadCustomers, loadProducts]);

  function retryCustomers() {
    setCustomersState("loading");
    loadCustomers();
  }

  function retryProducts() {
    setProductsState("loading");
    loadProducts();
  }

  const selectedProduct = products.find((product) => product.id === productId);
  const quantityValue = Number(quantity);
  const editing = mode === "edit";
  const total =
    selectedProduct && Number.isInteger(quantityValue) && quantityValue > 0
      ? selectedProduct.price * quantityValue
      : editing && sale?.totalAmount != null
        ? sale.totalAmount
        : 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customerId) {
      setError(
        customersState === "error"
          ? "Customers failed to load"
          : "Choose a customer.",
      );
      return;
    }
    if (!editing && !productId) {
      setError("Choose a product.");
      return;
    }
    if (!Number.isInteger(quantityValue) || quantityValue <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({ customerId, productId, quantity: quantityValue, status });
      toast.success(editing ? "Sale updated!" : "Sale recorded!");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit Sale" : "Record Sale"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="sale-customer" className={LABEL_CLASS}>
            Customer
          </label>
          <div className="relative">
            <select
              id="sale-customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              disabled={editing || customersState === "loading"}
              className={INPUT_CLASS}
            >
              <option value="">
                {customersState === "loading"
                  ? "Loading customers…"
                  : "Select customer"}
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            {customersState === "loading" && (
              <LoaderCircle
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400"
                aria-hidden
              />
            )}
          </div>
          {customersState === "error" && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-danger">
              Couldn&apos;t load customers.
              <button
                type="button"
                onClick={retryCustomers}
                className="font-semibold underline transition-colors hover:text-danger/80"
              >
                Retry
              </button>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="sale-product" className={LABEL_CLASS}>
            Product
          </label>
          <div className="relative">
            <select
              id="sale-product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              disabled={editing || productsState === "loading"}
              className={INPUT_CLASS}
            >
              <option value="">
                {productsState === "loading"
                  ? "Loading products…"
                  : editing
                    ? sale?.customLabel ?? "Custom amount"
                    : "Select product"}
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {formatNaira(product.price)}
                </option>
              ))}
            </select>
            {productsState === "loading" && (
              <LoaderCircle
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400"
                aria-hidden
              />
            )}
          </div>
          {productsState === "error" && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-danger">
              Couldn&apos;t load products.
              <button
                type="button"
                onClick={retryProducts}
                className="font-semibold underline transition-colors hover:text-danger/80"
              >
                Retry
              </button>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sale-quantity" className={LABEL_CLASS}>
              Quantity
            </label>
            <input
              id="sale-quantity"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={editing}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="sale-status" className={LABEL_CLASS}>
              Status
            </label>
            <select
              id="sale-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as SaleStatus)}
              className={INPUT_CLASS}
            >
              {SALE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
          Total: {formatNaira(total)}
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
            <Button type="submit" variant="primary" isLoading={saving}>
            {editing ? "Save Changes" : "Record Sale"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}