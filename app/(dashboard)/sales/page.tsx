"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronUp,
  CircleAlert,
  ImageIcon,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { QuantityControl } from "@/components/ui/quantity-control";
import type { SaleStatus } from "@/components/sales/sale-form-modal";
import {
  clearCart,
  getCart,
  setCart as persistCart,
  setQuantity,
  type CartItem,
} from "@/lib/cart-storage";

const PAYMENT_MODES = ["cash", "transfer", "pos", "credit"] as const;
type PaymentMode = (typeof PAYMENT_MODES)[number];

const PAYMENT_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  transfer: "Transfer",
  pos: "POS",
  credit: "Credit",
};

const MODE_STORAGE_KEY = "colly.quickSale.paymentMode";
const TOAST_MS = 2500;

/** How many past sales the list shows. The full history stays on /sales/all. */
const RECENT_LIMIT = 20;

const STATUS_STYLES: Record<SaleStatus, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  cancelled: "Cancelled",
};

/** One past sale, as returned by GET /api/sales. */
type RecentSale = {
  id: string;
  quantity: number;
  totalAmount: number;
  status: SaleStatus;
  paymentMethod: string | null;
  createdAt: string;
  customLabel: string | null;
  customer: { id: string; name: string };
  product: { id: string; name: string; images: string[] } | null;
};

type CustomerOption = {
  id: string;
  name: string;
};

/** Name shown for a sale, whether it is a catalogue item or a custom line. */
function saleName(sale: RecentSale): string {
  return sale.product?.name ?? sale.customLabel ?? "Custom amount";
}

/** "Cash" / "POS" / … for a stored payment method; null/unknown → "". */
function paymentLabel(method: string | null): string {
  if (!method) return "";
  return PAYMENT_LABELS[method as PaymentMode] ?? method;
}

function formatSaleDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SalesPage() {
  const [sales, setSales] = useState<RecentSale[] | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [todayTotal, setTodayTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersError, setCustomersError] = useState<string | null>(null);

  const [mode, setMode] = useState<PaymentMode>("cash");
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");

  const [customOpen, setCustomOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  const [cartExpanded, setCartExpanded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const customIdRef = useRef(0);

  // Every cart change updates React state and persists to sessionStorage, so
  // the cart survives the round-trip through /sales/quick.
  const updateCart = useCallback((next: CartItem[]) => {
    setCartState(next);
    persistCart(next);
  }, []);

  const loadCustomers = useCallback(() => {
    fetch("/api/customers")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((data: { customers?: CustomerOption[] }) => {
        setCustomers(data.customers ?? []);
        setCustomersError(null);
      })
      .catch((err: unknown) => {
        console.error("[sales] customers load failed:", err);
        setCustomersError(
          err instanceof Error ? err.message : "Something went wrong",
        );
      });
  }, []);

  function retryCustomers() {
    setCustomersError(null);
    loadCustomers();
  }

  // Restore the cart written by /sales/quick. sessionStorage is unavailable
  // during SSR, so this runs once after mount.
  useEffect(() => {
    const stored = getCart();
    if (stored.length > 0) {
      // Syncing React state from browser storage on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCartState(stored);
    }
  }, []);

  // Restore the last used payment mode (survives reloads).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored && (PAYMENT_MODES as readonly string[]).includes(stored)) {
        // Syncing React state from browser storage on mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode(stored as PaymentMode);
      }
    } catch {
      // Private mode / storage disabled: just keep the default.
    }
  }, []);

  // Past sales list + today's total, refreshed after each completed sale.
  useEffect(() => {
    let active = true;

    fetch("/api/sales")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((data: { sales?: RecentSale[] }) => {
        if (active) {
          setSales(data.sales ?? []);
          setSalesError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setSalesError(
            err instanceof Error ? err.message : "Something went wrong",
          );
        }
      });

    fetch("/api/sales/today")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { total?: number } | null) => {
        if (active && data) setTodayTotal(data.total ?? 0);
      })
      .catch(() => {
        // Leave the total at the last known value.
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Customers for the cart's customer selector (needed for credit sales).
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Auto-hide the success toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function chooseMode(next: PaymentMode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the mode still applies for this session.
    }
  }

  // Rewrites one line's quantity from an absolute value (not a delta), so both
  // the +/- buttons and the typed input funnel through the same helper. The
  // helper persists to sessionStorage and returns the new array for state.
  function setLineQuantity(id: string, quantity: number) {
    setCartState(setQuantity(id, quantity));
    setError(null);
  }

  function removeLine(id: string) {
    updateCart(cart.filter((line) => line.id !== id));
    setError(null);
  }

  function addCustomLine() {
    const label = customLabel.trim();
    const amount = Number(customAmount);

    if (!label) {
      setError("Give the custom amount a short name.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid custom amount.");
      return;
    }

    customIdRef.current += 1;
    updateCart([
      ...cart,
      {
        id: `custom-${Date.now()}-${customIdRef.current}`,
        productId: null,
        name: label,
        price: amount,
        image: null,
        quantity: 1,
      },
    ]);
    setCustomLabel("");
    setCustomAmount("");
    setCustomOpen(false);
    setError(null);
  }

  function clearAll() {
    updateCart([]);
    setError(null);
  }

  async function handleComplete() {
    if (cart.length === 0 || saving) return;

    if (mode === "credit" && !customerId) {
      setError("Choose a customer to sell on credit.");
      return;
    }

    setSaving(true);
    setError(null);

    const status = mode === "credit" ? "pending" : "paid";
    const customer = customerId || undefined;

    try {
      for (const line of cart) {
        const payload =
          line.productId !== null
            ? {
                customerId: customer,
                productId: line.productId,
                quantity: line.quantity,
                status,
                paymentMethod: mode,
              }
            : {
                customerId: customer,
                customLabel: line.name,
                unitAmount: line.price,
                quantity: line.quantity,
                status,
                paymentMethod: mode,
              };

        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to record sale");
        }
      }

      clearAll();
      clearCart();
      setToast("Sale recorded");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const completeDisabled =
    cart.length === 0 || saving || (mode === "credit" && !customerId);

  const recentSales = (sales ?? []).slice(0, RECENT_LIMIT);

  const cartPanel = (
    <CartPanel
      cart={cart}
      itemCount={itemCount}
      total={total}
      mode={mode}
      onChooseMode={chooseMode}
      customerId={customerId}
      onCustomerIdChange={setCustomerId}
      customers={customers}
      customersError={customersError}
      onRetryCustomers={retryCustomers}
      onSetQuantity={setLineQuantity}
      onRemoveLine={removeLine}
      onClear={clearAll}
      customOpen={customOpen}
      onCustomOpenChange={setCustomOpen}
      customLabel={customLabel}
      onCustomLabelChange={setCustomLabel}
      customAmount={customAmount}
      onCustomAmountChange={setCustomAmount}
      onAddCustomLine={addCustomLine}
      onComplete={handleComplete}
      completeDisabled={completeDisabled}
      saving={saving}
      error={error}
      onCloseMobile={() => setCartExpanded(false)}
    />
  );

  return (
    <div className="mx-auto w-full max-w-6xl pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
          Sales
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/sales/all"
            className="inline-flex items-center gap-1 text-sm font-semibold text-colly transition-colors hover:text-colly-hover"
          >
            View All Sales
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left — past sales */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-surface">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="font-display text-lg text-gray-900">
                Recent sales
              </h2>
              <p className="text-sm text-gray-500">
                Today:{" "}
                <span className="font-semibold text-gray-900">
                  {formatNaira(todayTotal)}
                </span>
              </p>
            </div>

            {sales === null && salesError === null && <RecentSalesSkeleton />}

            {salesError && (
              <div className="flex items-start gap-3 border-b border-gray-100 p-4 text-sm text-danger">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">Could not load sales</p>
                  <p className="text-danger/80">{salesError}</p>
                </div>
              </div>
            )}

            {sales !== null && recentSales.length === 0 && !salesError && (
              <div className="px-5 py-10 text-center">
                <ShoppingCart
                  className="mx-auto h-8 w-8 text-gray-300"
                  aria-hidden
                />
                <p className="mt-2 text-sm text-gray-500">
                  No sales yet. Add products and complete a sale.
                </p>
              </div>
            )}

            {recentSales.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {recentSales.map((sale) => (
                  <li
                    key={sale.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {saleName(sale)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatSaleDate(sale.createdAt)}
                        {paymentLabel(sale.paymentMethod)
                          ? ` · ${paymentLabel(sale.paymentMethod)}`
                          : ""}{" "}
                        · {sale.quantity} × ·{" "}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[sale.status]}`}
                        >
                          {STATUS_LABELS[sale.status]}
                        </span>
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                      {formatNaira(sale.totalAmount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add from catalog */}
          <Link
            href="/sales/quick"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-surface px-3 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add from catalog
          </Link>
        </div>

        {/* Right — permanent cart: sticky on desktop */}
        <aside className="hidden lg:block lg:sticky lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:rounded-lg lg:border lg:border-gray-200 lg:bg-surface lg:p-5">
          {cartPanel}
        </aside>
      </div>

      {/* Mobile — collapsed cart bar */}
      {!cartExpanded && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 h-16 border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)] lg:hidden"
          onClick={() => setCartExpanded(true)}
          role="button"
          tabIndex={0}
          aria-label={
            itemCount === 0
              ? "Cart is empty, tap to open"
              : `Cart with ${itemCount} items, tap to open`
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setCartExpanded(true);
            }
          }}
        >
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">
                {itemCount === 0
                  ? "0 items"
                  : `${itemCount} item${itemCount > 1 ? "s" : ""}`}
              </span>
              <span className="text-lg font-semibold text-gray-900">
                {formatNaira(total)}
              </span>
            </div>
            <Button
              type="button"
              variant="primary"
              disabled={cart.length === 0}
              className="h-9 px-4 text-sm"
              onClick={(event) => {
                event.stopPropagation();
                setCartExpanded(true);
              }}
            >
              View Cart
            </Button>
          </div>
        </div>
      )}

      {/* Mobile — expanded cart sheet */}
      {cartExpanded && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setCartExpanded(false)}
          aria-hidden="true"
        />
      )}

      {cartExpanded && (
        <aside
          className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-[0_-6px_24px_rgba(0,0,0,0.1)] lg:hidden"
          role="dialog"
          aria-label="Cart"
          aria-modal="true"
        >
          <div
            className="mx-auto mt-2 mb-3 h-1 w-10 rounded-full bg-gray-300"
            aria-hidden="true"
          />
          {cartPanel}
        </aside>
      )}

      {/* Success toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

type CartPanelProps = {
  cart: CartItem[];
  itemCount: number;
  total: number;
  mode: PaymentMode;
  onChooseMode: (mode: PaymentMode) => void;
  customerId: string;
  onCustomerIdChange: (value: string) => void;
  customers: CustomerOption[];
  customersError: string | null;
  onRetryCustomers: () => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onRemoveLine: (id: string) => void;
  onClear: () => void;
  customOpen: boolean;
  onCustomOpenChange: (open: boolean) => void;
  customLabel: string;
  onCustomLabelChange: (value: string) => void;
  customAmount: string;
  onCustomAmountChange: (value: string) => void;
  onAddCustomLine: () => void;
  onComplete: () => void;
  completeDisabled: boolean;
  saving: boolean;
  error: string | null;
  /** Hides the mobile sheet after an empty-cart hint is dismissed. */
  onCloseMobile: () => void;
};

function CartPanel({
  cart,
  itemCount,
  total,
  mode,
  onChooseMode,
  customerId,
  onCustomerIdChange,
  customers,
  customersError,
  onRetryCustomers,
  onSetQuantity,
  onRemoveLine,
  onClear,
  customOpen,
  onCustomOpenChange,
  customLabel,
  onCustomLabelChange,
  customAmount,
  onCustomAmountChange,
  onAddCustomLine,
  onComplete,
  completeDisabled,
  saving,
  error,
  onCloseMobile,
}: CartPanelProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-gray-900">
          Cart{itemCount > 0 ? ` (${itemCount})` : ""}
        </h2>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-gray-500 transition-colors hover:text-danger"
          >
            Clear
          </button>
        )}
      </div>

      {/* Items */}
      <div className="mt-3 space-y-3">
        {cart.length === 0 && (
          <Link
            href="/sales/quick"
            onClick={onCloseMobile}
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            <span>Cart is empty — add from catalog</span>
            <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
          </Link>
        )}

        {cart.map((line) => (
          <div key={line.id} className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
              {line.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.image}
                  alt={line.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <ImageIcon className="h-4 w-4" aria-hidden />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium text-gray-900">
                  {line.name}
                </p>
                <button
                  type="button"
                  onClick={() => onRemoveLine(line.id)}
                  aria-label={`Remove ${line.name}`}
                  className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {formatNaira(line.price)} each
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                {line.productId !== null ? (
                  <QuantityControl
                    quantity={line.quantity}
                    onChange={(quantity) => onSetQuantity(line.id, quantity)}
                  />
                ) : (
                  <span aria-hidden="true" />
                )}
                <p className="text-sm font-semibold text-gray-900">
                  {formatNaira(line.price * line.quantity)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom amount — the button stays visible and toggles the panel. */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onCustomOpenChange(!customOpen)}
          aria-expanded={customOpen}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <Plus
            className={`h-4 w-4 transition-transform ${customOpen ? "rotate-45" : ""}`}
            aria-hidden
          />
          Custom Amount
        </button>

        {customOpen && (
          <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <input
              type="text"
              value={customLabel}
              onChange={(event) => onCustomLabelChange(event.target.value)}
              placeholder="Item name"
              aria-label="Custom item name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-colly focus:ring-2 focus:ring-colly/20"
            />
            <input
              type="number"
              min="0"
              step="100"
              inputMode="decimal"
              value={customAmount}
              onChange={(event) => onCustomAmountChange(event.target.value)}
              placeholder="Amount (₦)"
              aria-label="Custom amount"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-colly focus:ring-2 focus:ring-colly/20"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAddCustomLine}
                className="flex-1 rounded-lg bg-colly px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  onCustomOpenChange(false);
                  onCustomLabelChange("");
                  onCustomAmountChange("");
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment mode */}
      <div className="mt-4">
        <p className="mb-1 block text-sm font-medium text-gray-700">
          Payment method
        </p>
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Payment method"
        >
          {PAYMENT_MODES.map((value) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChooseMode(value)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-colly bg-colly text-white"
                    : "border-gray-300 bg-surface text-gray-700 hover:bg-gray-50"
                }`}
              >
                {PAYMENT_LABELS[value]}
              </button>
            );
          })}
        </div>
      </div>

      {customersError && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span>Couldn&apos;t load customers — credit sales unavailable.</span>
          <button
            type="button"
            onClick={onRetryCustomers}
            className="font-semibold underline transition-colors hover:text-warning/80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Customer */}
      <div className="mt-4">
        <label
          htmlFor="sale-customer"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Customer
          {mode === "credit" ? (
            <span className="text-danger"> (required for credit)</span>
          ) : (
            <span className="text-gray-400"> (optional)</span>
          )}
        </label>
        <select
          id="sale-customer"
          value={customerId}
          onChange={(event) => onCustomerIdChange(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20"
        >
          <option value="">Walk-in customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      {/* Total */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
        <span className="text-sm text-gray-500">Total</span>
        <span className="font-display text-2xl text-gray-900">
          {formatNaira(total)}
        </span>
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="primary"
        loading={saving}
        disabled={completeDisabled}
        className="mt-3 w-full"
        onClick={onComplete}
      >
        Complete Sale
      </Button>
    </div>
  );
}

function RecentSalesSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-gray-100 px-5 py-3 last:border-b-0"
        >
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
