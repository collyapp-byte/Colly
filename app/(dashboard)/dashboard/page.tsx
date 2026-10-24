"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  MessagesSquare,
  MessageSquare,
  PhoneCall,
  Receipt,
  Wallet,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/ui/animated-counter";

type Stat = {
  label: string;
  value: string;
  icon: LucideIcon;
  href: string;
  title?: string;
};

export default function OverviewPage() {
  const [today, setToday] = useState<{ total: number; count: number } | null>(
    null,
  );
  const [pendingInvoices, setPendingInvoices] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<
    string | null | undefined
  >(undefined);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [paymentFailedAt, setPaymentFailedAt] = useState<
    string | null | undefined
  >(undefined);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  async function handleJoinWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappNumber.trim() || joiningWaitlist) return;

    setJoiningWaitlist(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumber: whatsappNumber.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to join the waitlist");
      }

      setWhatsappNumber("");
      toast.success("You are on the WhatsApp waitlist!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to join the waitlist",
      );
    } finally {
      setJoiningWaitlist(false);
    }
  }

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

    fetch("/api/business")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            business?: {
              telegramConnected?: boolean;
              discordConnected?: boolean;
              whatsappConnected?: boolean;
              paymentInstructions?: string | null;
              planStatus?: string;
              paymentFailedAt?: string | null;
            };
          } | null,
        ) => {
          if (active && data?.business) {
            const business = data.business;
            const isConnected =
              business.telegramConnected === true ||
              business.discordConnected === true ||
              business.whatsappConnected === true;
            setIsConnected(isConnected);
            setPaymentInstructions(business.paymentInstructions ?? null);
            setPlanStatus(business.planStatus ?? null);
            setPaymentFailedAt(business.paymentFailedAt ?? null);
          }
        },
      )
      .catch(() => {
        // Without a definite status, skip the banner rather than nag wrongly.
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
    {
      label: "Messages Handled",
      value: "—",
      icon: MessageSquare,
      href: "/conversations",
      title: "Coming soon",
    },
    {
      label: "Active Conversations",
      value: "—",
      icon: MessagesSquare,
      href: "/conversations",
      title: "Coming soon",
    },
    { label: "Pending Invoices", value: String(pendingInvoices ?? 0), icon: Receipt, href: "/invoices" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          Overview
        </h1>
      </div>

      {paymentFailedAt && planStatus === "past_due" && (
        <div
          role="alert"
          className="mb-6 flex flex-col gap-4 rounded-lg border border-red-300 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-red-900">
                Your last payment failed. Click here to update your card.
              </p>
              <p className="mt-1 text-sm text-red-800">
                Update your payment method to avoid losing access to your AI
                assistant.
              </p>
            </div>
          </div>
          <Link
            href="/settings/billing"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Update card
          </Link>
        </div>
      )}

      {paymentInstructions !== undefined && !paymentInstructions?.trim() && (
        <div className="mb-6 flex flex-col gap-4 rounded-lg border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                ⚠️ Add your payment details so your AI can close sales
                automatically.
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Customers need to know where to send payment before the AI can
                complete an order.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
          >
            Add payment details
          </Link>
        </div>
      )}

      {isConnected === false && (
        <div className="mb-6 flex flex-col gap-4 rounded-lg border border-[#FF6600]/30 bg-[#FFF4EC] p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6600]/10 text-[#FF6600]">
              <PhoneCall className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Your AI line is not connected yet.
              </p>
              <p className="mt-1 text-sm text-gray-600">
                You keep your current WhatsApp on your phone. We are setting up
                your new dedicated AI line. Once connected, you can post this
                new number on your WhatsApp Status and Instagram bio so
                customers can reach your AI.
              </p>
            </div>
          </div>
          <Link
            href="/settings/ai-line"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
          >
            View Setup Instructions
          </Link>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={
                stat.label === "Today's Sales" ? (
                  <AnimatedCounter value={today?.total ?? 0} prefix="₦" />
                ) : stat.label === "Pending Invoices" ? (
                  <AnimatedCounter value={pendingInvoices ?? 0} />
                ) : (
                  stat.value
                )
              }
              icon={<Icon className="h-[18px] w-[18px] stroke-[1.5]" aria-hidden />}
              href={stat.href}
              title={stat.title}
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

      <Card className="mt-6 border-[color:var(--outline-subtle)]!">
        <h2 className="text-sm font-semibold text-gray-900">
          Want to use WhatsApp?
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Meta requires a CAC for official API access. We are onboarding
          businesses manually. Join the waitlist.
        </p>
        <form
          onSubmit={handleJoinWaitlist}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="tel"
            value={whatsappNumber}
            onChange={(event) => setWhatsappNumber(event.target.value)}
            placeholder="+2348012345678"
            aria-label="WhatsApp number"
            required
            className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20 sm:max-w-xs"
          />
          <button
            type="submit"
            disabled={joiningWaitlist}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00] disabled:opacity-60"
          >
            {joiningWaitlist ? "Joining…" : "Join Waitlist"}
          </button>
        </form>
      </Card>
    </div>
  );
}