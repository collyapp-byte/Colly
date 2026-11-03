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
  { status: "INQUIRY", label: "Inquiry", background: "bg-blue-50" },
  { status: "NEGOTIATING", label: "Negotiating", background: "bg-amber-50" },
  { status: "PAID", label: "Paid", background: "bg-green-50" },
  { status: "DELIVERED", label: "Delivered", background: "bg-gray-50" },
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
          <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
            Customers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Everyone who has messaged your business, with their tags and spending.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-2 min-h-[44px] text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            List View
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`rounded-md px-3 py-2 min-h-[44px] text-sm font-medium transition-colors ${
              view === "kanban"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-900"
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
        <div className="rounded-lg border border-dashed border-gray-200 bg-surface p-10 text-center">
          <p className="mx-auto max-w-md text-sm text-gray-500">
            {EMPTY_STATE_TEXT}
          </p>
        </div>
      )}

      {customers && customers.length > 0 && view === "list" && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-surface md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
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
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="relative transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-4">
                      {/* Stretches the link over the whole row so the entire
                          customer row is clickable. */}
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-semibold text-gray-900 after:absolute after:inset-0"
                      >
                        {customer.name}
                      </Link>
                      {isAtRisk(customer) && (
                        <span className="ml-2 align-middle">
                          <AtRiskBadge />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-4">
                      <TagPills tags={customer.tags} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-900">
                      {formatNaira(customer.totalSpent)}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {customer.conversationCount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-500">
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
                  className="block rounded-lg border border-gray-200 bg-surface p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-semibold text-gray-900">
                      {customer.name}
                    </p>
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatRelativeTime(
                        customer.lastMessageAt ?? customer.createdAt,
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
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
                    <p className="text-sm text-gray-500">
                      {customer.conversationCount}{" "}
                      {customer.conversationCount === 1
                        ? "conversation"
                        : "conversations"}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
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
                        <h2 className="text-sm font-semibold text-gray-900">
                          {column.label}
                        </h2>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-gray-600">
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
                                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                              >
                                <Link
                                  href={`/customers/${customer.id}`}
                                  className="block"
                                >
                                  <p className="truncate font-semibold text-gray-900">
                                    {customer.name}
                                  </p>
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {customer.phone}
                                  </p>
                                  {isAtRisk(customer) && (
                                    <div className="mt-1">
                                      <AtRiskBadge />
                                    </div>
                                  )}
                                  <p className="mt-2 text-sm font-semibold text-gray-900">
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
    return <span className="text-gray-300">—</span>;
  }

  const visible = tags.slice(0, 3);
  const extra = tags.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full bg-[#FFF4EC] px-2 py-0.5 text-[11px] font-semibold text-[#C2410C]"
        >
          {tag}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
          +{extra}
        </span>
      )}
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-surface">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-b-0"
        >
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="hidden h-3.5 w-24 animate-pulse rounded bg-gray-100 sm:block" />
          <div className="h-3.5 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
