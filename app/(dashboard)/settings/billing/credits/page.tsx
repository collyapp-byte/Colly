"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleAlert, Coins, Info, LoaderCircle } from "lucide-react";
import { getCreditPackage, CREDIT_ECONOMY_DESCRIPTION } from "@/lib/plans";
import { formatNaira } from "@/lib/format";

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  // Split wallet: the monthly plan allowance and the paid top-up bucket, both
  // reported by /api/billing/usage.
  const [planCredits, setPlanCredits] = useState<number | null>(null);
  const [topUpCredits, setTopUpCredits] = useState<number | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/billing/usage");
        if (!res.ok) return;
        const data = await res.json();
        if (active && typeof data.creditBalance === "number") {
          setBalance(data.creditBalance);
        }
        if (active && typeof data.planCredits === "number") {
          setPlanCredits(data.planCredits);
        }
        if (active && typeof data.topUpCredits === "number") {
          setTopUpCredits(data.topUpCredits);
        }
        if (active && typeof data.plan === "string") {
          setPlan(data.plan);
        }
        if (active && typeof data.planStatus === "string") {
          setPlanStatus(data.planStatus);
        }
      } catch {
        // Balance stays hidden when usage can't be read; buying still works.
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const creditPackage = getCreditPackage({
    plan: plan ?? "free",
    planStatus: planStatus ?? "inactive",
  });

  async function buy() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/credits/checkout", {
        method: "POST",
      });

      if (res.status === 401) {
        throw new Error("You need to sign in again.");
      }

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error ?? "Could not start checkout");
      }

      if (typeof body?.authorization_url === "string") {
        window.location.assign(body.authorization_url);
      } else {
        setError("Payment link was not returned. Please try again.");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-gray-900">Buy credits</h1>
        <Link
          href="/settings/billing"
          className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Back to billing
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-surface p-6">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-colly" aria-hidden />
          <h2 className="font-display text-base text-gray-900">
            You have {balance === null ? "—" : `${balance.toLocaleString()} credits`}
          </h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">{CREDIT_ECONOMY_DESCRIPTION}</p>
        {planCredits !== null && topUpCredits !== null && (
          <p className="mt-1 text-xs text-gray-500">
            {planCredits.toLocaleString()} plan credits (reset every month) +{" "}
            {topUpCredits.toLocaleString()} top-up credits (never expire)
          </p>
        )}

        <div className="mt-6 rounded-lg border border-gray-200 bg-background p-5">
          <p className="text-lg font-semibold text-gray-900">
            {formatNaira(creditPackage.price)} for{" "}
            {creditPackage.credits.toLocaleString()} credits
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Top-up credits never expire. They are spent automatically as the AI
            replies to your customers, after your monthly plan credits run out.
          </p>
          <button
            type="button"
            onClick={buy}
            disabled={busy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-colly px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:opacity-60"
          >
            {busy && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            )}
            Top up {formatNaira(creditPackage.price)}
          </button>
        </div>

        <div className="mt-6 flex items-start gap-3 border-t border-gray-100 pt-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-900">What are credits?</p>
            <p className="mt-1">
              Credits are the currency Colly uses to pay for AI replies. 1 credit
              = 1 Naira: a Telegram, Discord or Web Chat reply costs 5 credits
              and a WhatsApp reply costs 80 credits. You can top up any time
              without changing your plan, and the credits you buy here never
              expire. Plan credits are the monthly allowance that comes with
              your subscription: they are reset to the monthly grant on every
              renewal, so unused allowance does not roll over. Manual
              replies you send yourself are always free. You always see both
              balances on your billing page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}