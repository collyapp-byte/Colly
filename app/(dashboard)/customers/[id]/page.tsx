"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { StatusBadge } from "@/components/conversations/status-badge";
import { formatRelativeTime } from "@/lib/format";

type ConversationSummary = {
  id: string;
  status: string;
  createdAt: string;
  lastMessage: { content: string; sender: string; createdAt: string } | null;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  conversations: ConversationSummary[];
};

function formatCustomerSince(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<CustomerDetailFallback />}>
      <CustomerDetail />
    </Suspense>
  );
}

/**
 * The customer id comes from the URL, which isn't known while the route is
 * being prerendered. Reading it therefore has to happen inside the Suspense
 * boundary above — Cache Components rejects URL data read outside one.
 */
function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/customers/${id}`);
        if (res.status === 404) {
          throw new Error("This customer could not be found.");
        }
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { customer: Customer } = await res.json();
        if (active) setCustomer(data.customer);
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

  const loading = customer === null && error === null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/customers"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Customers
      </Link>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <>
          <div className="rounded-lg border border-gray-200 bg-surface p-6">
            <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
            <div className="mt-3 h-3.5 w-32 animate-pulse rounded bg-gray-100" />
            <div className="mt-3 h-3 w-28 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </>
      )}

      {customer && (
        <>
          {/* Customer header */}
          <div className="rounded-lg border border-gray-200 bg-surface px-4 py-4 sm:px-6">
            <h1 className="truncate font-display text-xl text-gray-900">
              {customer.name}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">{customer.phone}</p>
            <p className="mt-2 text-xs text-gray-400">
              Customer since {formatCustomerSince(customer.createdAt)}
            </p>
          </div>

          {/* Conversations */}
          <section className="mt-4">
            <h2 className="mb-3 font-display text-lg text-gray-900">
              Conversations
            </h2>

            {customer.conversations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-surface p-10 text-center">
                <p className="text-sm text-gray-500">
                  No conversations yet for this customer.
                </p>
              </div>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-gray-200 bg-surface">
                {customer.conversations.map((conversation) => (
                  <li
                    key={conversation.id}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <Link
                      href={`/conversations/${conversation.id}`}
                      className="block px-4 py-4 transition-colors hover:bg-gray-50 sm:px-6"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={conversation.status} />
                        <span className="shrink-0 text-xs text-gray-400">
                          {formatRelativeTime(
                            conversation.lastMessage?.createdAt ??
                              conversation.createdAt,
                          )}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm text-gray-500">
                        {conversation.lastMessage?.content ?? "No messages yet"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Static shell shown until the customer id is available on the client. */
function CustomerDetailFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/customers"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Customers
      </Link>

      <div className="rounded-lg border border-gray-200 bg-surface p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-3 h-3.5 w-32 animate-pulse rounded bg-gray-100" />
        <div className="mt-3 h-3 w-28 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="mt-4 space-y-3">
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
