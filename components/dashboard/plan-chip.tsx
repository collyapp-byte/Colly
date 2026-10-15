"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Usage = {
  plan: string;
  planInterval: string;
  planStatus: string;
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

  let label = "Trial";
  let classes =
    "bg-[#FFF4EC] text-[#FF6600] border border-[#FF6600]/20";

  if (planStatus === "past_due") {
    label = "Payment due";
    classes = "bg-red-50 text-red-600 border-red-200";
  } else {
    const planMap: Record<string, string> = {
      trial: "Trial",
      starter: "Starter",
      business: "Business",
      pro: "Pro",
    };
    label = planMap[plan] ?? plan;
    if (plan === "trial") {
      classes = "bg-[#FFF4EC] text-[#FF6600] border border-[#FF6600]/20";
    } else {
      classes = "bg-gray-100 text-gray-700 border-gray-200";
    }
  }

  return (
    <Link
      href="/settings/billing"
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors hover:opacity-80 ${classes}`}
    >
      {label}
    </Link>
  );
}
