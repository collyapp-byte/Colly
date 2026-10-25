"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CircleAlert, Info } from "lucide-react";
import { formatNaira } from "@/lib/format";
import {
  LOW_CREDIT_MESSAGE,
  REPLY_CREDIT_COSTS,
  getCreditPackage,
} from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { toast } from "sonner";

type Usage = {
  aiRepliesUsed: number;
  manualMessagesUsed: number;
  /** Credit Economy: 1 credit = ₦1. */
  creditBalance: number;
  /** Credits the current plan grants each billing month. */
  planCredits: number;
  /** Credits one AI reply costs on this business's channel. */
  aiCreditCost: number;
  manualCreditCost: number;
  plan: string;
  planInterval: string;
  planStatus: string;
  planExpiresAt: string | null;
  channel: string;
  trialEndsAt: string | null;
  onboardingEndsAt?: string | null;
  subscriptionStatus: string | null;
  gracePeriodEndsAt: string | null;
};

type BillingTransaction = {
  id: string;
  reference: string;
  amount: number | string;
  status: string;
  type: string;
  channel: string | null;
  paidAt: string | null;
  createdAt: string;
};

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  trial: "Trial",
  starter: "Starter",
  business: "Business",
  pro: "Pro",
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  cancelled: "Cancelled",
  expired: "Expired",
};

const STATUS_BADGE: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  past_due: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-600",
  expired: "bg-red-100 text-red-700",
};

const PAYMENT_BADGE: Record<string, string> = {
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
};

const CHANNEL_LABELS: Record<string, string> = {
  TELEGRAM: "Telegram",
  DISCORD: "Discord",
  WHATSAPP: "WhatsApp",
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export default function BillingPage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [transactions, setTransactions] = useState<BillingTransaction[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [usageRes, txRes] = await Promise.all([
          fetch("/api/billing/usage"),
          fetch("/api/billing/transactions"),
        ]);

        if (usageRes.status === 401 || txRes.status === 401) {
          throw new Error("You need to sign in to view billing.");
        }

        const usageData: { error?: string } & Partial<Usage> =
          await usageRes.json();
        const txData: { error?: string } & {
          transactions?: BillingTransaction[];
        } = await txRes.json();

        if (!usageRes.ok || !txRes.ok) {
          throw new Error(
            usageData.error ?? txData.error ?? "Failed to load billing",
          );
        }

        if (!active) return;
        setUsage(usageData as Usage);
        setTransactions(txData.transactions ?? []);
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

  async function handleCancel() {
    if (
      !window.confirm(
        "Cancel your subscription? You will keep access until the end of your current billing period.",
      )
    ) {
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (res.status === 401) {
        throw new Error("You need to sign in again.");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to cancel subscription");
      }
      toast.success("Subscription cancelled. You keep access until renewal.");
      // Give the toast a moment to be seen before the page refreshes.
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      toast.error("Something went wrong. Please try again.");
      setCancelling(false);
    }
  }

  const loading = usage === null && error === null;
  const planName = usage ? PLAN_NAMES[usage.plan] ?? capitalize(usage.plan) : "";
  const isTrial = usage?.plan === "trial";
  const isFree = usage?.plan === "free";
  const aiCreditCost = usage?.aiCreditCost ?? REPLY_CREDIT_COSTS.standard;
  const channelLabel = CHANNEL_LABELS[usage?.channel ?? ""] ?? "this channel";
  const creditPackage = getCreditPackage(
    usage
      ? { plan: usage.plan, planStatus: usage.planStatus }
      : { plan: "free", planStatus: "inactive" },
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-gray-900">Billing</h1>
      </div>

      {loading && <BillingSkeleton />}

      {!usage && error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {usage && (
        <div className="mt-6 space-y-6">
          {/* DUNNING ALERT */}
          {usage.subscriptionStatus === "past_due" && (
            <DunningBanner gracePeriodEndsAt={usage.gracePeriodEndsAt} />
          )}

          {/* CURRENT PLAN */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Current plan
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl text-gray-900">
                    {planName}
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                      STATUS_BADGE[usage.planStatus] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABELS[usage.planStatus] ?? capitalize(usage.planStatus)}
                  </span>
                  {!isTrial && (
                    <span className="text-sm text-gray-500">
                      {usage.planInterval}
                    </span>
                  )}
                </div>

                {isTrial ? (
                  daysUntil(usage.trialEndsAt ?? usage.onboardingEndsAt ?? null) !== null && (
                    <p className="mt-1 text-sm text-gray-500">
                      Trial ends in{" "}
                      {daysUntil(usage.trialEndsAt ?? usage.onboardingEndsAt ?? null) === 0
                        ? "less than a day"
                        : `${daysUntil(usage.trialEndsAt ?? usage.onboardingEndsAt ?? null)} days`}
                    </p>
                  )
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    {usage.planStatus === "active"
                      ? `Renews on ${formatDate(usage.planExpiresAt)}`
                      : `Expires on ${formatDate(usage.planExpiresAt)}`}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <Link
                  href="/settings/billing/plans"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
                >
                  {isTrial ? "Choose a plan" : "Manage subscription"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                {!isTrial && usage.planStatus === "active" && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    isLoading={cancelling}
                    onClick={handleCancel}
                  >
                    Cancel subscription (keeps access until renewal)
                  </Button>
                )}
              </div>
            </div>

            {/* CREDITS */}
            <div className="mt-4 rounded-lg border border-gray-100 bg-background p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">
                  Credit balance
                </span>
                <span className="font-display text-xl text-gray-900">
                  {usage.creditBalance.toLocaleString()} credits
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {usage.planCredits > 0
                  ? `${usage.planCredits.toLocaleString()} credits are included ${
                      usage.plan === "trial"
                        ? "with your 7-day trial."
                        : "with your plan each billing month."
                    }`
                  : "Your current plan does not add credits — top up to keep the AI replying."}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {aiCreditCost} credits per AI reply on {channelLabel} · manual
                replies are free
              </p>
              {usage.creditBalance < aiCreditCost && (
                <p className="mt-2 text-xs font-medium text-danger">
                  {LOW_CREDIT_MESSAGE}
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">AI replies this month</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {usage.aiRepliesUsed.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-400">Manual replies this month</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {usage.manualMessagesUsed.toLocaleString()}
                </p>
              </div>
            </div>

            {/* TOP UP */}
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {usage.creditBalance.toLocaleString()} credits available
                </p>
                <p className="text-xs text-gray-500">
                  1 Credit = 1 Naira · credits never expire
                </p>
              </div>
              <Link
                href="/settings/billing/credits"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Top up credits
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            {(isFree || isTrial) && (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-gray-200 bg-background p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-900">
                    Site access is always available
                  </p>
                  <p className="mt-1">
                    Even without a plan you can use the dashboard, manage
                    products, chat manually and create invoices. Only AI
                    auto-replies and NRS transmission need a plan or credits.
                  </p>
                  <p className="mt-2">
                    Buy {creditPackage.label} for{" "}
                    {formatNaira(creditPackage.price)} to try the AI without
                    subscribing.
                  </p>
                </div>
              </div>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>{error}</p>
            </div>
          )}

          {/* BILLING HISTORY */}
          <section className="rounded-lg border border-gray-200 bg-surface p-5 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Billing history
            </h2>

            {transactions && transactions.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No transactions yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions?.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-900">
                          {tx.type === "subscription" ? "Subscription" : "Credits"}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap text-gray-900">
                          {formatNaira(Number(tx.amount))}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                              PAYMENT_BADGE[tx.status] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {capitalize(tx.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function DunningBanner({
  gracePeriodEndsAt,
}: {
  gracePeriodEndsAt: string | null;
}) {
  const days = daysUntil(gracePeriodEndsAt);

  return (
    <section
      role="alert"
      className="flex flex-col gap-3 rounded-lg border-2 border-danger bg-danger/5 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="font-display text-base font-semibold text-danger">
            Payment failed
          </p>
          <p className="mt-0.5 text-sm text-danger/90">
            {days === null
              ? "Your subscription payment failed. Please update your payment method to keep your AI replying."
              : days === 0
                ? "Your AI will stop today unless you update your payment method."
                : `Your AI will stop in ${days} ${days === 1 ? "day" : "days"} unless you update your payment method.`}
          </p>
        </div>
      </div>
      <a
        href="https://paystack.com/manage"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:self-auto"
      >
        Manage subscription
        <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </section>
  );
}

function BillingSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-lg border border-gray-200 bg-surface p-5 sm:p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
        <div className="mt-3 h-6 w-32 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-2 w-full animate-pulse rounded bg-gray-100" />
        <div className="mt-5 h-9 w-24 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="rounded-lg border border-gray-200 bg-surface p-5 sm:p-6">
        <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-8 w-full animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}