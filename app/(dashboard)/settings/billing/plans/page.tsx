"use client";

import { useState } from "react";
import { Check, Zap, Star } from "lucide-react";
import { PLANS, type PlanInterval, type PlanTier } from "@/lib/plans";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";

const TIERS: PlanTier[] = ["starter", "business", "pro"];

export default function PlansPage() {
  const [interval, setInterval] = useState<PlanInterval>("monthly");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(tier: PlanTier, interval: PlanInterval) {
    setCheckingOut(`${tier}-${interval}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!data.authorization_url) {
        throw new Error("No authorization_url in response");
      }

      // Redirect to Paystack
      window.location.assign(data.authorization_url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      console.error("[checkout] error:", msg);
      setError(msg);
      setCheckingOut(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col items-center">
        <h1 className="mt-4 text-center font-display text-2xl font-bold text-gray-900">
          Choose a plan
        </h1>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-full border bg-white p-1">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-4 py-1.5 text-sm ${
              interval === "monthly" ? "bg-gray-100" : ""
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`relative rounded-full px-4 py-1.5 text-sm ${
              interval === "yearly" ? "bg-gray-100" : ""
            }`}
          >
            Yearly
            <span className="absolute -top-2 -right-2 rounded-full bg-[#FF6600] px-1.5 py-0.5 text-[10px] text-white">
              Save 17%
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 mx-auto max-w-4xl rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const config = PLANS[tier];
          const price = interval === "monthly" ? config.monthlyPriceNaira : config.yearlyPriceNaira;
          const isFeatured = tier === "business";
          const Icon = isFeatured ? Star : Zap;

          return (
            <div
              key={tier}
              className={`relative rounded-2xl p-6 ${
                isFeatured ? "border-2 border-[#FF6600] bg-[#FFF4EC]" : "border border-gray-200 bg-white"
              }`}
            >
              <div className="absolute top-4 left-4 flex h-6 w-6 items-center justify-center rounded-full border bg-white">
                <Icon className="h-3.5 w-3.5" />
              </div>
              {isFeatured && (
                <span className="absolute top-4 right-4 rounded-full bg-[#FF6600] px-2.5 py-1 text-[11px] font-semibold text-white">
                  Most Popular
                </span>
              )}
              <h3 className="mt-4 text-sm font-semibold text-gray-900 capitalize">{tier}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {tier === "starter" ? "For solo sellers getting started" : "For growing businesses"}
              </p>
              <div className="mt-6">
                <span className="text-3xl font-bold text-gray-900">{formatNaira(price)}</span>
                <span className="ml-1 text-sm text-gray-500">{interval === "monthly" ? "/month" : "/year"}</span>
                {interval === "yearly" && (
                  <p className="text-xs text-gray-400 line-through">{formatNaira(config.monthlyPriceNaira * 12)}</p>
                )}
                {interval === "monthly" && (
                  <p className="text-xs text-gray-400">{formatNaira(config.yearlyPriceNaira)} if billed yearly</p>
                )}
              </div>
              <Button
                type="button"
                variant={isFeatured ? "primary" : "secondary"}
                loading={checkingOut === `${tier}-${interval}`}
                disabled={checkingOut !== null}
                className="mt-6 w-full"
                onClick={() => handleChoose(tier, interval)}
              >
                Choose {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </Button>
              <div className="mt-6 space-y-2">
                {tier === "starter" ? (
                  <>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">500 AI replies/month</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">1 WhatsApp number</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">Product catalogue</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">FAQ knowledge base</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">Owner takeover</span></div>
                  </>
                ) : tier === "business" ? (
                  <>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">1,500 AI replies/month</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">2 WhatsApp numbers</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">Everything in Starter</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">Priority support</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">Analytics</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">2,500 AI replies/month</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">5 WhatsApp numbers</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">Everything in Business</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">Dedicated support</span></div>
                    <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs text-gray-600">Advanced analytics</span></div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 text-center">
        <a href="/settings/billing/plans" className="text-sm text-gray-500">
          See all plans →
        </a>
      </div>
    </div>
  );
}
