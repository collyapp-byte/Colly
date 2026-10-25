"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Usage = {
  plan: string;
  planInterval: string;
  planStatus: string;
  /** Credit Economy: 1 credit = ₦1. Spendable now = plan + top-up credits. */
  creditBalance: number;
  /** Monthly plan allowance; reset on every renewal. */
  planCredits: number;
  /** Paid top-ups; never expire. */
  topUpCredits: number;
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  business: "Business",
  pro: "Pro",
  green: "Green",
  blue: "Blue",
  black: "Black",
};

export function PlanChip() {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/billing/usage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setUsage({
            plan: data.plan,
            planInterval: data.planInterval,
            planStatus: data.planStatus,
            creditBalance: data.creditBalance ?? 0,
            planCredits: data.planCredits ?? 0,
            topUpCredits: data.topUpCredits ?? 0,
          });
        }
      })
      .catch(() => {
        // ignore
      });
    return () => {
      active = false;
    };
  }, []);

  // The trial plan was retired: a business row still stored as "trial" is a
  // Free tier account now, so every check treats it as one.
  const plan = usage?.plan === "trial" ? "free" : usage?.plan ?? "free";
  const planStatus = usage?.planStatus ?? "inactive";
  const balance = usage?.creditBalance ?? 0;
  const planCredits = usage?.planCredits ?? 0;
  const topUpCredits = usage?.topUpCredits ?? 0;
  // The pill shows the spendable total; the tooltip explains the split.
  const balanceTitle = `${balance.toLocaleString()} credits available (${planCredits.toLocaleString()} plan + ${topUpCredits.toLocaleString()} top-up)`;

  let label = PLAN_LABELS[plan] ?? plan;
  let classes = "bg-gray-100 text-gray-700 border-gray-200";

  if (planStatus === "past_due") {
    label = "Payment due";
    classes = "bg-red-50 text-red-600 border-red-200";
  }

  const balanceClasses =
    balance > 0
      ? "bg-gray-100 text-gray-600 border border-gray-200"
      : "bg-red-50 text-red-600 border border-red-200";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/settings/billing"
        className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors hover:opacity-80 ${classes}`}
      >
        {label}
      </Link>

      {usage !== null && (
        <Link
          href="/settings/billing"
          title={balanceTitle}
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors hover:opacity-80 ${balanceClasses}`}
        >
          <span className="hidden sm:inline">
            {balance.toLocaleString()} credits
          </span>
          <span className="sm:hidden">{balance.toLocaleString()}</span>
        </Link>
      )}
    </div>
  );
}
