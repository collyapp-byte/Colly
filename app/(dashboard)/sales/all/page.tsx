"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CircleAlert,
  LoaderCircle,
  Pencil,
  Plus,
  Trash,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  SaleFormModal,
  SALE_STATUSES,
  type SaleInput,
  type SaleStatus,
} from "@/components/sales/sale-form-modal";
import { NrsBanner } from "@/components/sales/nrs-banner";
import { NrsModal } from "@/components/sales/nrs-modal";
import { formatNaira } from "@/lib/format";
import type { Business } from "@/lib/business";

type Sale = {
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

/** "Cash" / "POS" / … for a stored payment method; null → "—". */
function paymentLabel(method: string | null): string {
  if (!method) return "—";
  const labels: Record<string, string> = {
    cash: "Cash",
    transfer: "Transfer",
    pos: "POS",
    credit: "Credit",
  };
  return labels[method] ?? method;
}

/** Name shown for a sale, whether it is a catalogue item or a custom line. */
function saleItemName(sale: Sale): string {
  return sale.product?.name ?? sale.customLabel ?? "Custom amount";
}

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; sale: Sale }
  | { kind: "delete"; sale: Sale };

const EMPTY_STATE_TEXT =
  "No sales yet. Record your first sale or wait for the AI to close one.";

const FILTER_CLASS =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [business, setBusiness] = useState<Business | null>(null);
  const [nrsOpen, setNrsOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (fromFilter) params.set("from", fromFilter);
        if (toFilter) params.set("to", toFilter);
        const query = params.toString();

        const res = await fetch(`/api/sales${query ? `?${query}` : ""}`);
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { sales: Sale[] } = await res.json();
        if (active) {
          setSales(data.sales);
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
  }, [statusFilter, fromFilter, toFilter, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const loadBusiness = useCallback(async () => {
    try {
      const res = await fetch("/api/business");
      if (!res.ok) return;
      const data: { business: Business } = await res.json();
      setBusiness(data.business);
    } catch {
      // The NRS banner simply stays hidden if the profile can't be loaded.
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/business")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { business: Business } | null) => {
        if (active && data) setBusiness(data.business);
      })
      .catch(() => {
        // The NRS banner simply stays hidden if the profile can't be loaded.
      });

    return () => {
      active = false;
    };
  }, []);

  const closeModal = useCallback(() => setModal({ kind: "closed" }), []);

  async function handleCreate(values: SaleInput) {
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create sale");
    }

    refresh();
  }

  async function handleUpdate(sale: Sale, values: SaleInput) {
    const res = await fetch(`/api/sales/${sale.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: values.status }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to update sale");
    }

    refresh();
  }

  async function handleDelete(sale: Sale) {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete sale");
      }

      setModal({ kind: "closed" });
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  const total = (sales ?? []).reduce((sum, sale) => sum + sale.totalAmount, 0);
  const loading = sales === null && error === null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href="/sales"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-colly/30 bg-colly/5 px-3 py-1.5 text-sm font-semibold text-colly transition-colors hover:bg-colly/10"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Sales
      </Link>

      <NrsBanner
        business={business}
        onOpen={() => setNrsOpen(true)}
        onDismissed={loadBusiness}
      />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
            Sales
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Every sale your business has recorded, with totals for the current
            filter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModal({ kind: "create" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Record Sale
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-surface px-6 py-4">
        <p className="text-sm text-gray-500">
          Total{sales && sales.length > 0 ? ` (${sales.length} sale${sales.length === 1 ? "" : "s"})` : ""}
        </p>
        <p className="font-display text-2xl text-gray-900">
          {formatNaira(total)}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="filter-status">
          Status
        </label>
        <select
          id="filter-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className={FILTER_CLASS}
        >
          <option value="all">All statuses</option>
          {SALE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="filter-from">
          From
        </label>
        <input
          id="filter-from"
          type="date"
          value={fromFilter}
          onChange={(event) => setFromFilter(event.target.value)}
          className={FILTER_CLASS}
        />

        <label className="sr-only" htmlFor="filter-to">
          To
        </label>
        <input
          id="filter-to"
          type="date"
          value={toFilter}
          onChange={(event) => setToFilter(event.target.value)}
          className={FILTER_CLASS}
        />
      </div>

      {loading && <SalesSkeleton />}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Could not load sales</p>
            <p className="text-danger/80">{error}</p>
          </div>
        </div>
      )}

      {sales && sales.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-surface p-10 text-center">
          <p className="mx-auto max-w-md text-sm text-gray-500">
            {EMPTY_STATE_TEXT}
          </p>
        </div>
      )}

      {sales && sales.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-surface md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th scope="col" className="px-6 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Qty
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Payment
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                      {formatSaleDate(sale.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {sale.customer.name}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {saleItemName(sale)}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{sale.quantity}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {paymentLabel(sale.paymentMethod)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {formatNaira(sale.totalAmount)}
                    </td>
                    <td className="px-6 py-4">
                      <SaleStatusBadge status={sale.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <ActionButtons
                          onEdit={() => setModal({ kind: "edit", sale })}
                          onDelete={() =>
                            setModal({ kind: "delete", sale })
                          }
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
            {sales.map((sale) => (
              <li
                key={sale.id}
                className="rounded-lg border border-gray-200 bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {sale.customer.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {saleItemName(sale)} × {sale.quantity} ·{" "}
                      {formatSaleDate(sale.createdAt)}
                    </p>
                  </div>
                  <SaleStatusBadge status={sale.status} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="font-display text-lg text-gray-900">
                    {formatNaira(sale.totalAmount)}
                  </p>
                  <ActionButtons
                    onEdit={() => setModal({ kind: "edit", sale })}
                    onDelete={() => setModal({ kind: "delete", sale })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {modal.kind === "create" && (
        <SaleFormModal
          mode="create"
          onClose={closeModal}
          onSubmit={handleCreate}
        />
      )}

      {modal.kind === "edit" && (
        <SaleFormModal
          mode="edit"
          sale={modal.sale}
          onClose={closeModal}
          onSubmit={(values) => handleUpdate(modal.sale, values)}
        />
      )}

      {modal.kind === "delete" && (
        <Modal title="Delete sale" onClose={closeModal}>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this sale by{" "}
            <span className="font-semibold text-gray-900">
              {modal.sale.customer.name}
            </span>{" "}
            for{" "}
            <span className="font-medium text-gray-900">
              {formatNaira(modal.sale.totalAmount)}
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
              onClick={() => handleDelete(modal.sale)}
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

      {nrsOpen && (
        <NrsModal onClose={() => setNrsOpen(false)} onSaved={loadBusiness} />
      )}
    </div>
  );
}

function formatSaleDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SaleStatusBadge({ status }: { status: SaleStatus }) {
  const styles: Record<SaleStatus, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    cancelled: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

type ActionButtonsProps = {
  onEdit: () => void;
  onDelete: () => void;
};

function ActionButtons({ onEdit, onDelete }: ActionButtonsProps) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit sale"
        title="Edit"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete sale"
        title="Delete"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-danger"
      >
        <Trash className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function SalesSkeleton() {
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
          <div className="h-6 w-14 animate-pulse rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}