"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CircleAlert,
  Eye,
  LoaderCircle,
  Plus,
  Receipt,
  Trash,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BackButton } from "@/components/ui/back-button";
import { formatNaira } from "@/lib/format";

const INVOICE_STATUSES = ["draft", "sent", "failed", "cancelled"] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  vat: number;
  total: number;
  createdAt: string;
  customer: { id: string; name: string; phone: string } | null;
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const FILTER_CLASS =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

function formatInvoiceDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isThisMonth(value: string): boolean {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (fromFilter) params.set("from", fromFilter);
        if (toFilter) params.set("to", toFilter);
        const query = params.toString();

        const res = await fetch(`/api/invoices${query ? `?${query}` : ""}`);
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { invoices: Invoice[] } = await res.json();
        if (active) {
          setInvoices(data.invoices);
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

  // A second, unfiltered load powers the summary cards so they always describe
  // the whole business rather than the current table filter.
  useEffect(() => {
    let active = true;

    fetch("/api/invoices")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { invoices: Invoice[] } | null) => {
        if (active && data) setAllInvoices(data.invoices);
      })
      .catch(() => {
        // The summary simply stays at zero if it cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  async function handleDelete(invoice: Invoice) {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete invoice");
      }

      setDeleteTarget(null);
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  const loading = invoices === null && error === null;

  const monthTotal = allInvoices
    .filter((invoice) => invoice.status !== "cancelled")
    .filter((invoice) => isThisMonth(invoice.createdAt))
    .reduce((sum, invoice) => sum + invoice.total, 0);
  const pendingCount = allInvoices.filter(
    (invoice) => invoice.status === "draft",
  ).length;
  const failedCount = allInvoices.filter(
    (invoice) => invoice.status === "failed",
  ).length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackButton />
          <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            NRS-ready invoices. Every paid sale creates one automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create Invoice
        </button>
      </div>

      {/* Summary */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-surface p-5">
          <p className="text-sm text-gray-500">Total invoiced this month</p>
          <p className="mt-2 font-display text-2xl text-gray-900">
            {formatNaira(monthTotal)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-surface p-5">
          <p className="text-sm text-gray-500">Pending NRS transmission</p>
          <p className="mt-2 font-display text-2xl text-gray-900">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-surface p-5">
          <p className="text-sm text-gray-500">Failed transmission</p>
          <p
            className={`mt-2 font-display text-2xl ${
              failedCount > 0 ? "text-danger" : "text-gray-900"
            }`}
          >
            {failedCount}
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="invoice-status">
          Status
        </label>
        <select
          id="invoice-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className={FILTER_CLASS}
        >
          <option value="all">All statuses</option>
          {INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="invoice-from">
          From
        </label>
        <input
          id="invoice-from"
          type="date"
          value={fromFilter}
          onChange={(event) => setFromFilter(event.target.value)}
          className={FILTER_CLASS}
        />

        <label className="sr-only" htmlFor="invoice-to">
          To
        </label>
        <input
          id="invoice-to"
          type="date"
          value={toFilter}
          onChange={(event) => setToFilter(event.target.value)}
          className={FILTER_CLASS}
        />
      </div>

      {loading && <InvoicesSkeleton />}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Could not load invoices</p>
            <p className="text-danger/80">{error}</p>
          </div>
        </div>
      )}

      {invoices && invoices.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-surface p-10 text-center">
          <Receipt className="mx-auto h-8 w-8 text-gray-300" aria-hidden />
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            No invoices yet. Every paid sale creates one automatically.
          </p>
        </div>
      )}

      {invoices && invoices.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-surface md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th scope="col" className="px-6 py-3 font-medium">
                    Invoice #
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 font-medium">
                    NRS Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-900">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="transition-colors hover:text-colly"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                      {formatInvoiceDate(invoice.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {invoice.customer?.name ?? "Walk-in Customer"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {formatNaira(invoice.total)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <InvoiceActions
                          invoice={invoice}
                          onDelete={() => {
                            setDeleteError(null);
                            setDeleteTarget(invoice);
                          }}
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
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="rounded-lg border border-gray-200 bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-semibold text-gray-900 transition-colors hover:text-colly"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {invoice.customer?.name ?? "Walk-in Customer"} ·{" "}
                      {formatInvoiceDate(invoice.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="font-display text-lg text-gray-900">
                    {formatNaira(invoice.total)}
                  </p>
                  <InvoiceActions
                    invoice={invoice}
                    onDelete={() => {
                      setDeleteError(null);
                      setDeleteTarget(invoice);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating && (
        <CreateInvoiceModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {deleteTarget && (
        <Modal title="Delete invoice" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete invoice{" "}
            <span className="font-semibold text-gray-900">
              {deleteTarget.invoiceNumber}
            </span>
            ? This cannot be undone.
          </p>

          {deleteError && (
            <p className="mt-3 text-sm text-danger">{deleteError}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDelete(deleteTarget)}
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

function InvoiceActions({
  invoice,
  onDelete,
}: {
  invoice: Invoice;
  onDelete: () => void;
}) {
  const deletable = invoice.status === "draft" || invoice.status === "cancelled";

  return (
    <div className="flex gap-1">
      <Link
        href={`/invoices/${invoice.id}`}
        aria-label={`View invoice ${invoice.invoiceNumber}`}
        title="View"
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <Eye className="h-4 w-4" aria-hidden />
      </Link>
      {deletable && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete invoice ${invoice.invoiceNumber}`}
          title="Delete"
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-danger"
        >
          <Trash className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

type LineItemInput = {
  key: number;
  name: string;
  quantity: string;
  unitPrice: string;
};

const CREATE_LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const CREATE_INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

let nextLineKey = 1;

function CreateInvoiceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<LineItemInput[]>([
    { key: nextLineKey++, name: "", quantity: "1", unitPrice: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/customers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { customers?: { id: string; name: string }[] } | null) => {
        if (active && data) setCustomers(data.customers ?? []);
      })
      .catch(() => {
        // Leave the dropdown empty; saving still works without a customer.
      });

    return () => {
      active = false;
    };
  }, []);

  function updateLine(key: number, patch: Partial<LineItemInput>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { key: nextLineKey++, name: "", quantity: "1", unitPrice: "" },
    ]);
  }

  function removeLine(key: number) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  const parsedLines = lines.map((line) => ({
    name: line.name.trim(),
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
  }));
  const subtotal = parsedLines.reduce((sum, line) => {
    const total =
      Number.isFinite(line.quantity) && Number.isFinite(line.unitPrice)
        ? line.quantity * line.unitPrice
        : 0;
    return sum + (Number.isFinite(total) ? total : 0);
  }, 0);
  const vat = subtotal * 0.075;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (parsedLines.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    for (const line of parsedLines) {
      if (!line.name) {
        setError("Every line item needs a name.");
        return;
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        setError("Every line item needs a positive whole-number quantity.");
        return;
      }
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
        setError("Every line item needs a unit price of 0 or more.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          items: parsedLines,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create invoice");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <Modal title="Create Invoice" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="invoice-customer" className={CREATE_LABEL_CLASS}>
            Customer
          </label>
          <select
            id="invoice-customer"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className={CREATE_INPUT_CLASS}
          >
            <option value="">Walk-in Customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Line items</p>
          {lines.map((line) => (
            <div key={line.key} className="rounded-lg border border-gray-200 p-3">
              <input
                type="text"
                value={line.name}
                onChange={(event) =>
                  updateLine(line.key, { name: event.target.value })
                }
                placeholder="Item name"
                aria-label="Item name"
                className={CREATE_INPUT_CLASS}
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(line.key, { quantity: event.target.value })
                  }
                  aria-label="Quantity"
                  className={CREATE_INPUT_CLASS}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(event) =>
                    updateLine(line.key, { unitPrice: event.target.value })
                  }
                  placeholder="Unit price"
                  aria-label="Unit price"
                  className={CREATE_INPUT_CLASS}
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label="Remove line item"
                    title="Remove"
                    className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-danger"
                  >
                    <Trash className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add line
          </button>
        </div>

        <div className="space-y-1 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-700">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatNaira(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>VAT (7.5%)</span>
            <span>{formatNaira(vat)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatNaira(subtotal + vat)}</span>
          </div>
        </div>

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
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-colly px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:opacity-60"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            Create Invoice
          </button>
        </div>
      </form>
    </Modal>
  );
}

function InvoicesSkeleton() {
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
