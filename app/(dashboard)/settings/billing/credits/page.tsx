"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleAlert, Coins, Info, LoaderCircle } from "lucide-react";
import { getCreditPackage } from "@/lib/plans";
import { formatNaira } from "@/lib/format";

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/billing/usage");
        if (!res.ok) return;
        const data = await res.json();
        if (active && typeof data.creditWalletBalanceNaira === "number") {
          setBalance(data.creditWalletBalanceNaira);
        }
        if (active && typeof data.plan === "string") {
          setPlan(data.plan);
        }
        if (active && typeof data.planStatus === "string") {
          setPlanStatus(data.planStatus);
        }
        if (active && typeof data.channel === "string") {
          setChannel(data.channel);
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
    channel,
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
            You have {balance === null ? "—" : formatNaira(balance)} in your
            wallet
          </h2>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-background p-5">
          <p className="text-lg font-semibold text-gray-900">
            {formatNaira(creditPackage.price)} for{" "}
            {creditPackage.messages.toLocaleString()} extra AI replies
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Credits never expire. They are used after your monthly plan
            allowance runs out.
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
              Credits are extra AI replies you can buy once, without changing
              your plan. They sit on top of your monthly allowance and roll
              over forever, so they are a good option if you have a busy month
              you don&apos;t want to commit a new plan to. You always see how
              many you have left on your billing page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}