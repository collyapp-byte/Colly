import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { formatNaira, formatRelativeTime } from "@/lib/format";
import { StatusBadge } from "@/components/conversations/status-badge";
import { CustomerTags } from "@/components/customers/customer-tags";
import { CustomerNotes } from "@/components/customers/customer-notes";

const SALE_STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-surface-muted text-muted",
};

export default async function CustomerDetailPage({
  params,
}: PageProps<"/customers/[id]">) {
  await connection();
  const { id } = await params;
  const user = await requireAuth();

  const customer = await prisma.customer.findFirst({
    where: { id, businessId: user.businessId },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quantity: true,
          totalAmount: true,
          status: true,
          paymentMethod: true,
          customLabel: true,
          createdAt: true,
          product: { select: { name: true } },
          invoices: { select: { id: true, invoiceNumber: true } },
        },
      },
      conversations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/customers"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-all duration-250 hover:text-main"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Customers
      </Link>

      <header className="surface-card overflow-hidden">
        <div className="bg-gradient-to-br from-[#FFF4EC] via-white to-white px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl text-main">
                {customer.name}
              </h1>
              <p className="mt-1 text-sm text-muted">{customer.phone}</p>
              <p className="mt-1 text-xs text-muted">
                Customer since {formatCustomerSince(customer.createdAt)}
              </p>
            </div>

            <div className="rounded-lg border border-[#FF6600]/15 bg-card-surface/80 px-4 py-2 text-right shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Total spent
              </p>
              <p className="mt-0.5 font-display text-xl text-main">
                {formatNaira(customer.totalSpent)}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-card-border px-5 py-4 sm:px-6">
          <CustomerTags
            customerId={customer.id}
            businessId={user.businessId}
            initialTags={customer.tags}
          />
        </div>
      </header>

      <section className="mt-6">
        <h2 className="font-display text-lg text-main">Notes</h2>
        <p className="mt-0.5 text-xs text-muted">
          Private to your team. The AI only sees these as context, it never
          repeats them to the customer.
        </p>
        <div className="surface-panel mt-3 p-4">
          <CustomerNotes
            customerId={customer.id}
            businessId={user.businessId}
            initialNotes={customer.notes}
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-muted" aria-hidden />
          <h2 className="font-display text-lg text-main">Sales History</h2>
          {customer.sales.length > 0 && (
            <span className="text-xs text-muted">
              {customer.sales.length}{" "}
              {customer.sales.length === 1 ? "sale" : "sales"}
            </span>
          )}
        </div>

        {customer.sales.length === 0 ? (
          <div className="rounded-lg border border-dashed border-card-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              No sales recorded for this customer yet.
            </p>
          </div>
        ) : (
          <ul className="surface-card overflow-hidden">
            {customer.sales.map((sale) => {
              const title =
                sale.product?.name ?? sale.customLabel ?? "Custom sale";

              return (
                <li
                  key={sale.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-card-border px-4 py-3 last:border-b-0 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-main">
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatRelativeTime(sale.createdAt)} · Qty {sale.quantity}
                      {sale.paymentMethod
                        ? ` · ${paymentLabel(sale.paymentMethod)}`
                        : ""}
                    </p>
                    {sale.invoices.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {sale.invoices.map((invoice) => (
                          <Link
                            key={invoice.id}
                            href={`/invoices/${invoice.id}`}
                            className="text-xs font-medium text-[#FF6600] hover:underline"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-main">
                      {formatNaira(Number(sale.totalAmount))}
                    </p>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        SALE_STATUS_STYLES[sale.status] ??
                        "bg-surface-muted text-muted"
                      }`}
                    >
                      {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg text-main">
          Conversations
        </h2>

        {customer.conversations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-card-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">
              No conversations yet for this customer.
            </p>
          </div>
        ) : (
          <ul className="surface-card overflow-hidden">
            {customer.conversations.map((conversation) => {
              const lastMessage = conversation.messages[0] ?? null;

              return (
                <li
                  key={conversation.id}
                  className="border-b border-card-border last:border-b-0"
                >
                  <Link
                    href={`/conversations/${conversation.id}`}
                    className="block px-4 py-4 transition-all duration-250 hover:bg-surface-muted sm:px-6"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={conversation.status} />
                      <span className="shrink-0 text-xs text-muted">
                        {formatRelativeTime(
                          lastMessage?.createdAt ?? conversation.createdAt,
                        )}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm text-muted">
                      {lastMessage?.content ?? "No messages yet"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatCustomerSince(createdAt: Date): string {
  return createdAt.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function paymentLabel(method: string): string {
  return method.charAt(0).toUpperCase() + method.slice(1);
}
