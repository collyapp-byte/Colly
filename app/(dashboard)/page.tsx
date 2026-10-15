"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessagesSquare,
  MessageSquare,
  Receipt,
  Wallet,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";

type Stat = {
  label: string;
  value: string;
  icon: LucideIcon;
  href: string;
};

export default function OverviewPage() {
  const [today, setToday] = useState<{ total: number; count: number } | null>(
    null,
  );
  const [pendingInvoices, setPendingInvoices] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/sales/today")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { total?: number; count?: number } | null) => {
        if (active && data) {
          setToday({ total: data.total ?? 0, count: data.count ?? 0 });
        }
      })
      .catch(() => {
        // Leave the card at ₦0; the endpoint error is not worth a banner here.
      });

    fetch("/api/invoices")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { invoices?: { status: string }[] } | null) => {
        if (active && data) {
          const pending = (data.invoices ?? []).filter(
            (invoice) => invoice.status === "draft" || invoice.status === "failed",
          ).length;
          setPendingInvoices(pending);
        }
      })
      .catch(() => {
        // Leave the card at 0 if invoices cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, []);

  const stats: Stat[] = [
    {
      label: "Today's Sales",
      value: formatNaira(today?.total ?? 0),
      icon: Wallet,
      href: "/sales",
    },
    { label: "Messages Handled", value: "0", icon: MessageSquare, href: "/conversations" },
    { label: "Active Conversations", value: "0", icon: MessagesSquare, href: "/conversations" },
    { label: "Pending Invoices", value: String(pendingInvoices ?? 0), icon: Receipt, href: "/invoices" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          Overview
        </h1>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={<Icon className="h-[18px] w-[18px] stroke-[1.5]" aria-hidden />}
              href={stat.href}
            />
          );
        })}
      </section>

      <Card className="mt-6 border-[color:var(--outline-subtle)]!">
        <h2 className="text-sm font-semibold text-gray-900">Sales Over Time</h2>
        <div className="py-12 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-300" aria-hidden />
          <p className="mt-4 text-base font-semibold text-gray-900">No sales yet</p>
          <p className="mt-1 text-sm text-gray-500 text-center">
            When you record your first sale, your trend will appear here.
          </p>
          <Link
            href="/sales"
            className="mt-6 inline-block rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
          >
            Record a sale
          </Link>
        </div>
      </Card>
    </div>
  );
}