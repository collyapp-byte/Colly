"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/format";

type Usage = {
  plan: string;
  planInterval: string;
  planStatus: string;
  creditWalletBalanceNaira: number;
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  trial: "Trial",
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
            creditWalletBalanceNaira: data.creditWalletBalanceNaira ?? 0,
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

  const plan = usage?.plan ?? "trial";
  const planStatus = usage?.planStatus ?? "trialing";
  const balance = usage?.creditWalletBalanceNaira ?? 0;

  let label = "Trial";
  let classes =
    "bg-[#FFF4EC] text-[#FF6600] border border-[#FF6600]/20";

  if (planStatus === "past_due") {
    label = "Payment due";
    classes = "bg-red-50 text-red-600 border-red-200";
  } else {
    label = PLAN_LABELS[plan] ?? plan;
    if (plan === "trial") {
      classes = "bg-[#FFF4EC] text-[#FF6600] border border-[#FF6600]/20";
    } else {
      classes = "bg-gray-100 text-gray-700 border-gray-200";
    }
  }

  const walletClasses =
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
          title={`${formatNaira(balance)} in your credit wallet`}
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors hover:opacity-80 ${walletClasses}`}
        >
          <span className="hidden sm:inline">
            {formatNaira(balance)} credits
          </span>
          <span className="sm:hidden">{formatNaira(balance)}</span>
        </Link>
      )}
    </div>
  );
}
