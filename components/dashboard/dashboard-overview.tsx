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

/**
 * The alert-banner inputs, read on the server by
 * `app/(dashboard)/dashboard/page.tsx`.
 *
 * These four values decide whether the red/amber/orange banners exist. They
 * used to arrive from `/api/business` *after* hydration, so the banners popped
 * in above the stat grid and pushed every card on the page down — the biggest
 * layout shift (CLS) on this route. Rendered from the server row instead, the
 * banners are part of the first paint and nothing moves; the fetch in the
 * effect below only refreshes them.
 */
export type DashboardStatus = {
  /** Stored bank/transfer instructions. `null` or blank means "add them". */
  paymentInstructions: string | null;
  /** A channel credential is stored (Telegram or Discord bot token). */
  isConnected: boolean;
  planStatus: string | null;
  /** ISO timestamp of the last failed charge, when there is one. */
  paymentFailedAt: string | null;
};

/**
 * The interactive half of the Overview route.
 *
 * `app/(dashboard)/dashboard/page.tsx` is a Server Component because it reads
 * the setup-checklist flags and the banner status straight from Prisma;
 * everything below this line needs client state (fetches for today's sales and
 * invoices), so it lives here and is rendered as that page's child. The page
 * owns the `max-w-6xl` container and the "Overview" heading.
 *
 * `status` arrives pre-filled from the server, so the alert banners are laid
 * out in the first paint. They used to be fetched after hydration, which
 * dropped ~100–200px of content in above the stat grid and pushed every card
 * down — the page's main CLS source.
 */
export function DashboardOverview({ status }: { status: DashboardStatus }) {
  const [today, setToday] = useState<{ total: number; count: number } | null>(
    null,
  );
  const [pendingInvoices, setPendingInvoices] = useState<number | null>(null);
  // Seeded from the server so the banners below are laid out on the first
  // paint; the `/api/business` fetch refreshes them in place.
  const [isConnected, setIsConnected] = useState<boolean>(status.isConnected);
  const [paymentInstructions, setPaymentInstructions] = useState<
    string | null
  >(status.paymentInstructions);
  const [planStatus, setPlanStatus] = useState<string | null>(
    status.planStatus,
  );
  const [paymentFailedAt, setPaymentFailedAt] = useState<string | null>(
    status.paymentFailedAt,
  );
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
      label: "Available AI Replies", 
      value: "—",
      icon: MessageSquare,
      href: "/credits",
      title: "Coming soon",
    },
    {
      label: "Today's Sales",
      value: formatNaira(today?.total ?? 0),
      icon: Wallet,
      href: "/sales",
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
    <>
      {paymentFailedAt && planStatus === "past_due" && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-xl border border-red-300/80 bg-red-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-red-900/60 dark:bg-red-950/40"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                Your last payment failed. Click here to update your card.
              </p>
              <p className="mt-1 text-sm text-red-800 dark:text-red-300">
                Update your payment method to avoid losing access to your AI
                assistant.
              </p>
            </div>
          </div>
          <Link
            href="/settings/billing"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            Update card
          </Link>
        </div>
      )}

      {/* Both conditions are now definite on the first render (the server row
          supplies them), so these banners are part of the page's first paint
          instead of being appended above the stat grid after hydration. */}
      {!paymentInstructions?.trim() && (
        <div className="flex flex-col gap-4 rounded-xl border border-amber-300/80 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5 dark:border-amber-900/60 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                ⚠️ Add your payment details so your AI can close sales
                automatically.
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                Customers need to know where to send payment before the AI can
                complete an order.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:bg-amber-700 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            Add payment details
          </Link>
        </div>
      )}

      {isConnected === false && (
        <div className="flex flex-col gap-4 rounded-xl border border-colly/25 bg-colly-tint p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6600]/10 text-[#FF6600]">
              <PhoneCall className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-main">
                Your AI line is not connected yet.
              </p>
              <p className="mt-1 text-sm text-muted">
                You keep your current WhatsApp on your phone. We are setting up
                your new dedicated AI line. Once connected, you can post this
                new number on your WhatsApp Status and Instagram bio so
                customers can reach your AI.
              </p>
            </div>
          </div>
          <Link
            href="/settings/ai-line"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-colly px-4 py-2 text-sm font-medium text-white shadow-brand transition-all duration-250 hover:-translate-y-0.5 hover:bg-colly-hover hover:shadow-brand-hover active:translate-y-0 active:scale-[0.98]"
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

      {/* Two-up on desktop so the page does not end in a tall single column of
          half-empty cards; the trend panel keeps the wider share. */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-main">Sales Over Time</h2>
              <p className="mt-1 text-xs text-muted">Your last seven days</p>
            </div>
          </div>

          {/* Two quick numbers turn the panel into a dashboard tile instead of an
              empty box waiting for its first chart. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="surface-panel px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Today
              </p>
              <p className="mt-0.5 text-sm font-semibold text-main">
                {formatNaira(today?.total ?? 0)}
              </p>
            </div>
            <div className="surface-panel px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Orders
              </p>
              <p className="mt-0.5 text-sm font-semibold text-main">
                {today?.count ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-card-ring bg-surface-muted/40 px-4 py-7 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card-surface text-colly shadow-card">
              <BarChart3 className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 text-base font-semibold text-main">No sales yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              When you record your first sale, your trend will appear here.
            </p>
            <Link
              href="/sales"
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-colly px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all duration-250 hover:-translate-y-0.5 hover:bg-colly-hover hover:shadow-brand-hover active:translate-y-0 active:scale-[0.98]"
            >
              Record a sale
            </Link>
          </div>
        </Card>

        <Card className="flex flex-col lg:col-span-2">
          <h2 className="text-sm font-semibold text-main">
            Want to use WhatsApp?
          </h2>
          <p className="mt-2 flex-1 text-sm text-muted">
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
              className="min-h-[44px] w-full rounded-xl border border-card-ring px-3 py-2 text-sm text-main outline-none transition-all duration-250 focus:border-colly focus:ring-2 focus:ring-colly/20 sm:max-w-xs"
            />
            <button
              type="submit"
              disabled={joiningWaitlist}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-colly px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all duration-250 hover:-translate-y-0.5 hover:bg-colly-hover hover:shadow-brand-hover active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {joiningWaitlist ? "Joining…" : "Join Waitlist"}
            </button>
          </form>
        </Card>
      </div>

      <p className="text-center text-xs text-muted">
        Want a weekly email report?{" "}
        <Link
          href="/settings"
          className="font-medium text-colly transition-all duration-250 hover:text-colly-hover"
        >
          Ensure your email is verified in settings.
        </Link>
      </p>
    </>
  );
}
