"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Star, Zap } from "lucide-react";
import {
  TELEGRAM_PLANS,
  type PlanConfig,
  type PlanInterval,
  type TelegramPlanTier,
} from "@/lib/plans";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";

const TELEGRAM_TIERS: TelegramPlanTier[] = ["green", "blue", "black"];

// A reply count at or above this is treated as unlimited in the UI.
const UNLIMITED = 999_999;

type CardMeta = {
  name: string;
  tagline: string;
  badge?: string;
  dark?: boolean;
  featured?: boolean;
};

const TELEGRAM_META: Record<TelegramPlanTier, CardMeta> = {
  green: { name: "Green", tagline: "For new Telegram sellers" },
  blue: { name: "Blue", tagline: "For growing businesses" },
  black: {
    name: "Black",
    tagline: "Maximum reach, no limits",
    badge: "Best Value",
    dark: true,
  },
};

/** The bullet list under a card. Message counts come from the plan config. */
function cardFeatures(tier: TelegramPlanTier, config: PlanConfig): string[] {
  const messages =
    config.includedMsgs >= UNLIMITED
      ? "Unlimited Messages"
      : `${config.includedMsgs.toLocaleString()} AI replies/month`;
  const manual =
    config.includedManualMessages >= UNLIMITED
      ? "Unlimited manual replies"
      : `${config.includedManualMessages.toLocaleString()} manual replies/month`;

  if (tier === "green") {
    return [messages, manual, "Telegram bot connection", "Product catalogue", "FAQ knowledge base"];
  }
  if (tier === "blue") {
    return [messages, manual, "Everything in Green", "Analytics", "Priority support"];
  }
  return [messages, manual, "Everything in Blue", "Dedicated support", "Advanced analytics"];
}

function PlansContent() {
  const searchParams = useSearchParams();
  const [interval, setInterval] = useState<PlanInterval>("monthly");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The tier the customer picked before signing up. It is stored on the
  // business row at signup, so it survives the signup -> confirm email ->
  // dashboard journey; the ?plan= query param covers a direct visit.
  const [storedPlan, setStoredPlan] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/business")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: { business?: { selectedPlan?: string | null } } | null) => {
          if (active) setStoredPlan(data?.business?.selectedPlan ?? null);
        },
      )
      .catch(() => {
        // The plans page works without the pre-selection; ignore the failure.
      });

    return () => {
      active = false;
    };
  }, []);

  const urlPlan = (searchParams.get("plan") ?? "").trim();
  const selectedTier = TELEGRAM_TIERS.includes(urlPlan as TelegramPlanTier)
    ? urlPlan
    : TELEGRAM_TIERS.includes(storedPlan as TelegramPlanTier)
      ? storedPlan
      : null;

  async function handleChoose(tier: string, chosenInterval: PlanInterval) {
    setCheckingOut(`${tier}-${chosenInterval}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "TELEGRAM", tier, interval: chosenInterval }),
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

  const tiers = TELEGRAM_TIERS;
  const plans = TELEGRAM_PLANS as Record<string, PlanConfig>;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col items-center">
        <h1 className="mt-4 text-center font-display text-2xl font-bold text-gray-900">
          Choose a plan
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">
          WhatsApp plans will be available soon. For now, enjoy Telegram with
          drastically higher limits and zero Meta fees.
        </p>
      </div>

      {/* BILLING TOGGLE */}
      <div className="mt-5 flex justify-center">
        <div className="inline-flex rounded-full border bg-white p-1">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-4 py-1.5 text-sm ${
              interval === "monthly"
                ? "bg-gray-100 font-medium"
                : "text-gray-600"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm ${
              interval === "yearly"
                ? "bg-gray-100 font-medium"
                : "text-gray-600"
            }`}
          >
            Yearly
            <span className="rounded-full bg-[#FFF4EC] px-2 py-0.5 text-[10px] font-semibold text-[#FF6600]">
              Save 2 months
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 mx-auto max-w-4xl rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {selectedTier && (
        <div className="mx-auto mt-4 max-w-4xl rounded-lg border border-[#FF6600] bg-[#FFF4EC] px-4 py-3 text-sm text-gray-700">
          You picked the{" "}
          <span className="font-semibold text-gray-900">
            {TELEGRAM_META[selectedTier as TelegramPlanTier].name}
          </span>{" "}
          plan. Choose it below to activate it.
        </div>
      )}

      {/* PLAN CARDS */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => {
          const config = plans[tier];
          const price = interval === "monthly" ? config.monthly : config.yearly;
          const yearlySaving = config.monthly * 12 - config.yearly;
          const meta: CardMeta = TELEGRAM_META[tier];
          const isDark = Boolean(meta.dark);
          const isFeatured = Boolean(meta.featured);
          const isSelected = tier === selectedTier;
          const Icon = isFeatured || isDark ? Star : Zap;

          const cardClasses = [
            isDark
              ? "border-2 border-gray-900 bg-gray-900 text-white"
              : isFeatured
                ? "border-2 border-[#FF6600] bg-[#FFF4EC]"
                : "border border-gray-200 bg-white",
            isSelected ? "ring-2 ring-[#FF6600] ring-offset-2" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={tier} className={`relative rounded-2xl p-6 ${cardClasses}`}>
              <div
                className={`absolute top-4 left-4 flex h-6 w-6 items-center justify-center rounded-full border ${
                  isDark ? "border-gray-700 bg-gray-800 text-white" : "bg-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              {meta.badge && (
                <span
                  className={`absolute top-4 right-4 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isDark
                      ? "bg-white text-gray-900"
                      : "bg-[#FF6600] text-white"
                  }`}
                >
                  {meta.badge}
                </span>
              )}

              <h3 className={`mt-4 text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                {meta.name}
              </h3>
              <p className={`mt-1 text-xs ${isDark ? "text-gray-300" : "text-gray-500"}`}>
                {meta.tagline}
              </p>
              {isSelected && (
                <p className="mt-2 inline-flex items-center rounded-full bg-[#FF6600] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Your choice
                </p>
              )}

              <div className="mt-6">
                <span className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {formatNaira(price)}
                </span>
                <span className={`ml-1 text-sm ${isDark ? "text-gray-300" : "text-gray-500"}`}>
                  {interval === "monthly" ? "/month" : "/year"}
                </span>
                {interval === "yearly" ? (
                  <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-400"}`}>
                    <span className="line-through">{formatNaira(config.monthly * 12)}</span>{" "}
                    Save {formatNaira(yearlySaving)}
                  </p>
                ) : (
                  <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-400"}`}>
                    {formatNaira(config.yearly)} if billed yearly
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant={isDark || isFeatured ? "primary" : "secondary"}
                loading={checkingOut === `${tier}-${interval}`}
                disabled={checkingOut !== null}
                className="mt-6 w-full"
                onClick={() => handleChoose(tier, interval)}
              >
                Choose {meta.name}
              </Button>

              <div className="mt-6 space-y-2">
                {cardFeatures(tier, config).map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-gray-400" />
                    <span className={`text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlansPage() {
  // `useSearchParams` needs a Suspense boundary around it, otherwise the page
  // cannot be prerendered.
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <PlansContent />
    </Suspense>
  );
}
