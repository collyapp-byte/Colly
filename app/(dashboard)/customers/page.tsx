"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/ui/back-button";
import { formatNaira, formatRelativeTime } from "@/lib/format";

type DealStatus = "INQUIRY" | "NEGOTIATING" | "PAID" | "DELIVERED";

type CustomerListItem = {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  tags: string[];
  dealStatus: DealStatus;
  totalSpent: number;
  createdAt: string;
  lastContactedAt: string | null;
  conversationCount: number;
  lastMessageAt: string | null;
};

type ViewMode = "list" | "kanban";

const DEAL_COLUMNS: {
  status: DealStatus;
  label: string;
  background: string;
}[] = [
  {
    status: "INQUIRY",
    label: "Inquiry",
    background: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    status: "NEGOTIATING",
    label: "Negotiating",
    background: "bg-amber-50 dark:bg-amber-950/30",
  },
  { status: "PAID", label: "Paid", background: "bg-green-50 dark:bg-green-950/30" },
  { status: "DELIVERED", label: "Delivered", background: "bg-surface-muted" },
];

function isDealStatus(value: string): value is DealStatus {
  return DEAL_COLUMNS.some((column) => column.status === value);
}

const AT_RISK_MS = 30 * 24 * 60 * 60 * 1000;

function isAtRisk(customer: CustomerListItem): boolean {
  if (
    customer.dealStatus !== "INQUIRY" &&
    customer.dealStatus !== "NEGOTIATING"
  ) {
    return false;
  }

  const date =
    customer.lastContactedAt ??
    customer.lastMessageAt ??
    customer.createdAt;
  return Date.now() - new Date(date).getTime() > AT_RISK_MS;
}

function AtRiskBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
      At Risk
    </span>
  );
}

const EMPTY_STATE_TEXT =
  "No customers yet. When someone messages your AI line on Telegram or Discord, they'll appear here.";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/customers");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { customers: CustomerListItem[] } = await res.json();
        if (active) setCustomers(data.customers);
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
  }, []);

  const loading = customers === null && error === null;

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId } = result;
    if (!destination || !isDealStatus(destination.droppableId)) return;

    const nextStatus = destination.droppableId;
    const customer = customers?.find((item) => item.id === draggableId);
    if (!customer || customer.dealStatus === nextStatus) return;

    const previousStatus = customer.dealStatus;
    setCustomers((prev) =>
      prev
        ? prev.map((item) =>
            item.id === draggableId
              ? { ...item, dealStatus: nextStatus }
              : item,
          )
        : prev,
    );

    try {
      const res = await fetch("/api/customers/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: draggableId,
          businessId: customer.businessId,
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update customer status");
      }
    } catch (err) {
      setCustomers((prev) =>
        prev
          ? prev.map((item) =>
              item.id === draggableId
                ? { ...item, dealStatus: previousStatus }
                : item,
            )
          : prev,
      );
      toast.error(
        err instanceof Error ? err.message : "Failed to update customer status",
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackButton />
          <h1 className="font-display text-2xl text-main sm:text-3xl">
            Customers
          </h1>
          <p className="mt-1 text-sm text-muted">
            Everyone who has messaged your business, with their tags and spending.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-card-ring bg-surface-muted/60 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-lg px-3 py-2 min-h-[44px] text-sm font-medium transition-all duration-250 active:scale-[0.97] ${
              view === "list"
                ? "bg-card-surface text-main shadow-card"
                : "text-muted hover:text-main"
            }`}
          >
            List View
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`rounded-lg px-3 py-2 min-h-[44px] text-sm font-medium transition-all duration-250 active:scale-[0.97] ${
              view === "kanban"
                ? "bg-card-surface text-main shadow-card"
                : "text-muted hover:text-main"
            }`}
          >
            Kanban View
          </button>
        </div>
      </div>

      {loading && <CustomersSkeleton />}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Could not load customers</p>
            <p className="text-danger/80">{error}</p>
          </div>
        </div>
      )}

      {customers && customers.length === 0 && (
        <div className="rounded-xl border border-dashed border-card-ring bg-surface-muted/40 p-10 text-center">
          <p className="mx-auto max-w-md text-sm text-muted">
            {EMPTY_STATE_TEXT}
          </p>
        </div>
      )}

      {customers && customers.length > 0 && view === "list" && (
        <>
          {/* Desktop table */}
          <div className="hidden surface-card overflow-hidden md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-card-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Phone
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tags
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Total Spent
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Conversations
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="relative transition-all duration-250 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-4">
                      {/* Stretches the link over the whole row so the entire
                          customer row is clickable. */}
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-semibold text-main after:absolute after:inset-0"
                      >
                        {customer.name}
                      </Link>
                      {isAtRisk(customer) && (
                        <span className="ml-2 align-middle">
                          <AtRiskBadge />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-4">
                      <TagPills tags={customer.tags} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-main">
                      {formatNaira(customer.totalSpent)}
                    </td>
                    <td className="px-4 py-4 text-muted">
                      {customer.conversationCount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">
                      {formatRelativeTime(
                        customer.lastMessageAt ?? customer.createdAt,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="surface-card surface-card-interactive block p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-semibold text-main">
                      {customer.name}
                    </p>
                    <span className="shrink-0 text-xs text-muted">
                      {formatRelativeTime(
                        customer.lastMessageAt ?? customer.createdAt,
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {customer.phone}
                  </p>
                  {isAtRisk(customer) && (
                    <div className="mt-1">
                      <AtRiskBadge />
                    </div>
                  )}
                  {customer.tags.length > 0 && (
                    <div className="mt-2">
                      <TagPills tags={customer.tags} />
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      {customer.conversationCount}{" "}
                      {customer.conversationCount === 1
                        ? "conversation"
                        : "conversations"}
                    </p>
                    <p className="text-sm font-semibold text-main">
                      {formatNaira(customer.totalSpent)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {customers && customers.length > 0 && view === "kanban" && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {DEAL_COLUMNS.map((column) => {
              const columnCustomers = customers.filter(
                (customer) => customer.dealStatus === column.status,
              );

              return (
                <Droppable droppableId={column.status} key={column.status}>
                  {(provided) => (
                    <section
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[240px] rounded-lg p-3 ${column.background}`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-main">
                          {column.label}
                        </h2>
                        <span className="rounded-full bg-card-surface/80 px-2 py-0.5 text-xs font-semibold text-muted">
                          {columnCustomers.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {columnCustomers.map((customer, index) => (
                          <Draggable
                            draggableId={customer.id}
                            index={index}
                            key={customer.id}
                          >
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className="surface-card p-4"
                              >
                                <Link
                                  href={`/customers/${customer.id}`}
                                  className="block"
                                >
                                  <p className="truncate font-semibold text-main">
                                    {customer.name}
                                  </p>
                                  <p className="mt-0.5 text-xs text-muted">
                                    {customer.phone}
                                  </p>
                                  {isAtRisk(customer) && (
                                    <div className="mt-1">
                                      <AtRiskBadge />
                                    </div>
                                  )}
                                  <p className="mt-2 text-sm font-semibold text-main">
                                    {formatNaira(customer.totalSpent)}
                                  </p>
                                </Link>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </section>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

function TagPills({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="text-muted">—</span>;
  }

  const visible = tags.slice(0, 3);
  const extra = tags.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full bg-colly-tint px-2 py-0.5 text-[11px] font-semibold text-colly"
        >
          {tag}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">
          +{extra}
        </span>
      )}
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <div className="surface-card overflow-hidden">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-card-border px-6 py-4 last:border-b-0"
        >
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-surface-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
          </div>
          <div className="hidden h-3.5 w-24 animate-pulse rounded bg-surface-muted sm:block" />
          <div className="h-3.5 w-16 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}
