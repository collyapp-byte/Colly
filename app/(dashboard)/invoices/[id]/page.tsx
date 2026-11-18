"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CircleAlert, Printer, Receipt, Send } from "lucide-react";
import { formatNaira } from "@/lib/format";

type InvoiceStatus = "draft" | "sent" | "paid" | "failed" | "cancelled";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
  paid: "bg-emerald-600 text-white",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-surface-muted text-muted",
};

type InvoiceItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  vat: number;
  total: number;
  items: InvoiceItem[];
  irn: string | null;
  qrCode: string | null;
  nrsSentAt: string | null;
  nrsError: string | null;
  createdAt: string;
  /** Payment proof the customer sent in chat, when the AI drafted this. */
  receiptUrl: string | null;
  notes: string | null;
  customer: { id: string; name: string; phone: string } | null;
};

function formatInvoiceDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isImageSource(value: string): boolean {
  return value.startsWith("http") || value.startsWith("data:image");
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={<InvoiceDetailFallback />}>
      <InvoiceDetail />
    </Suspense>
  );
}

/**
 * The invoice id comes from the URL, which isn't known while the route is being
 * prerendered, so reading it happens inside the Suspense boundary above.
 */
function InvoiceDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (res.status === 404) {
          throw new Error("This invoice could not be found.");
        }
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { invoice: Invoice } = await res.json();
        if (active) setInvoice(data.invoice);
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
  }, [id]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loading = invoice === null && error === null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/invoices"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-all duration-250 hover:text-main"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Invoices
      </Link>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {loading && <InvoiceDetailSkeleton />}

      {invoice && (
        <>
          {/* Header */}
          <div className="surface-card px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-xl text-main">
                  {invoice.invoiceNumber}
                </h1>
                <p className="mt-0.5 text-sm text-muted">
                  Issued {formatInvoiceDate(invoice.createdAt)}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[invoice.status]}`}
              >
                {STATUS_LABELS[invoice.status]}
              </span>
            </div>

            <div className="mt-4 border-t border-card-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Billed to
              </p>
              <p className="mt-1 font-semibold text-main">
                {invoice.customer?.name ?? "Walk-in Customer"}
              </p>
              {invoice.customer?.phone && (
                <p className="text-sm text-muted">{invoice.customer.phone}</p>
              )}
            </div>

            {(invoice.receiptUrl || invoice.notes) && (
              <div className="mt-4 border-t border-card-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Payment proof
                </p>
                {invoice.notes && (
                  <p className="mt-1 text-sm text-main">{invoice.notes}</p>
                )}
                {invoice.receiptUrl && (
                  <a
                    href={invoice.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-colly transition-all duration-250 hover:underline"
                  >
                    <Receipt className="h-4 w-4" aria-hidden />
                    View customer receipt
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="mt-4 surface-card overflow-hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-card-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                    Item
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Qty
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Unit Price
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-medium sm:px-6"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {invoice.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-main sm:px-6">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-right text-main">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-main">
                      {formatNaira(item.unitPrice)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-main sm:px-6">
                      {formatNaira(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 border-t border-card-border px-4 py-4 text-sm text-main sm:px-6">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatNaira(invoice.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>VAT (7.5%)</span>
                <span>{formatNaira(invoice.vat)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-card-border pt-1 font-display text-lg text-main">
                <span>Total</span>
                <span>{formatNaira(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* NRS */}
          <div className="mt-4 surface-card px-4 py-5 sm:px-6">
            <h2 className="font-display text-lg text-main">NRS e-invoicing</h2>
            <p className="mt-1 text-sm text-muted">
              Transmission to the National Revenue Service is not connected yet.
            </p>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Status</dt>
                <dd className="font-medium text-main">
                  {STATUS_LABELS[invoice.status]}
                </dd>
              </div>
              {invoice.irn && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">IRN</dt>
                  <dd className="break-all font-medium text-main">
                    {invoice.irn}
                  </dd>
                </div>
              )}
            </dl>

            {invoice.nrsError && (
              <p className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {invoice.nrsError}
              </p>
            )}

            {invoice.qrCode && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  QR code
                </p>
                {isImageSource(invoice.qrCode) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={invoice.qrCode}
                    alt="NRS invoice QR code"
                    className="h-40 w-40 rounded-lg border border-card-border"
                  />
                ) : (
                  <code className="block break-all rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">
                    {invoice.qrCode}
                  </code>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setToast("Coming soon")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-all duration-250 hover:bg-colly-hover"
            >
              <Send className="h-4 w-4" aria-hidden />
              Transmit to NRS
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2.5 text-sm font-medium text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
          </div>
        </>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function InvoiceDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="surface-card p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-muted" />
        <div className="mt-3 h-3.5 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 h-16 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="mt-4 h-64 animate-pulse rounded-lg bg-surface-muted" />
    </div>
  );
}

function InvoiceDetailFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/invoices"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-all duration-250 hover:text-main"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Invoices
      </Link>
      <InvoiceDetailSkeleton />
    </div>
  );
}
