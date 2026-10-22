"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { formatNaira, formatRelativeTime } from "@/lib/format";

type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  totalSpent: number;
  createdAt: string;
  conversationCount: number;
  lastMessageAt: string | null;
};

const EMPTY_STATE_TEXT =
  "No customers yet. When someone messages your WhatsApp, they'll appear here.";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
          Customers
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Everyone who has messaged your business, with their tags and spending.
        </p>
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

      {customers && customers.length > 0 && (
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
