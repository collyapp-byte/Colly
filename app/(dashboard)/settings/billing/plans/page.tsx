"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Star, Zap } from "lucide-react";
import {
  CREDIT_ECONOMY_DESCRIPTION,
  CREDITS_RESET_DISCLAIMER,
  PLANS,
  REPLY_CREDIT_COSTS,
  bonusCreditsBadge,
  creditReplyCalculator,
  type PlanConfig,
  type PlanInterval,
  type PlanTier,
} from "@/lib/plans";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";

const PLAN_TIERS: PlanTier[] = ["green", "blue", "black"];

type CardMeta = {
  name: string;
  tagline: string;
  badge?: string;
  dark?: boolean;
  featured?: boolean;
  /** Tint for a light card; Black keeps the dark theme instead. */
  tone?: CardTone;
};

/** Light plans are tinted with their own colour: emerald Green, blue Blue. */
type CardTone = "emerald" | "blue";

const PLAN_META: Record<PlanTier, CardMeta> = {
  green: { name: "Green", tagline: "For getting started", tone: "emerald" },
  blue: { name: "Blue", tagline: "For growing businesses", tone: "blue" },
  black: {
    name: "Black",
    tagline: "Maximum reach for high-volume teams",
    badge: "Best Value",
    dark: true,
  },
};

/**
 * Per-plan card tint. The class strings are literals (never interpolated) so
 * Tailwind's scanner keeps them; text stays dark for contrast.
 */
const LIGHT_CARD_STYLES: Record<
  CardTone,
  { card: string; credit: string; check: string }
> = {
  emerald: {
    card: "border border-emerald-100 bg-emerald-50/50",
    credit: "text-emerald-700",
    check: "text-emerald-600",
  },
  blue: {
    card: "border border-blue-100 bg-blue-50/50",
    credit: "text-blue-700",
    check: "text-blue-600",
  },
};

/** The bullet list under a card. Credit grants come from the plan config. */
function cardFeatures(config: PlanConfig): string[] {
  return [
    `${config.credits.toLocaleString()} credits every month (${config.baseCredits.toLocaleString()} base + ${config.bonusCredits.toLocaleString()} bonus)`,
    config.bonusDescription,
    `${REPLY_CREDIT_COSTS.standard} credits per Telegram, Discord & Web Chat reply`,
    `${REPLY_CREDIT_COSTS.whatsapp} credits per WhatsApp reply`,
    "Product catalogue",
    "FAQ knowledge base",
    "Owner alerts",
  ];
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
  const selectedTier = PLAN_TIERS.includes(urlPlan as PlanTier)
    ? urlPlan
    : PLAN_TIERS.includes(storedPlan as PlanTier)
      ? storedPlan
      : null;

  async function handleChoose(tier: string, chosenInterval: PlanInterval) {
    setCheckingOut(`${tier}-${chosenInterval}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval: chosenInterval }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(
          errorData.error || errorData.message || "Failed to start checkout",
        );
      }

      const data = (await res.json().catch(() => ({}))) as {
        authorization_url?: string;
      };

      if (!data.authorization_url) {
        throw new Error("No authorization_url in response");
      }

      // Redirect to Paystack
      window.location.assign(data.authorization_url);
    } catch (error) {
      console.error("[checkout] error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to start checkout",
      );
      setCheckingOut(null);
    }
  }

  const tiers = PLAN_TIERS;
  const plans = PLANS as Record<string, PlanConfig>;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col items-center">
        <h1 className="mt-4 text-center font-display text-2xl font-bold text-gray-900">
          Choose a plan
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">
          Choose the plan that matches your credit volume. Every plan includes
          the same AI features.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#FF6600]/30 bg-[#FFF4EC] px-3 py-1 text-xs font-medium text-[#C2410C]">
          {CREDIT_ECONOMY_DESCRIPTION}
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
              {PLAN_META[selectedTier as PlanTier].name}
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
          const meta: CardMeta = PLAN_META[tier];
          const isDark = Boolean(meta.dark);
          const isFeatured = Boolean(meta.featured);
          const isSelected = tier === selectedTier;
          const tone = meta.tone ? LIGHT_CARD_STYLES[meta.tone] : null;
          const Icon = isFeatured || isDark ? Star : Zap;

          const cardClasses = [
            isDark
              ? "border-2 border-gray-900 bg-gray-900 text-white"
              : isFeatured
                ? "border-2 border-[#FF6600] bg-[#FFF4EC]"
                : tone
                  ? tone.card
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
                <Icon className={`h-3.5 w-3.5 ${tone ? tone.check : ""}`} />
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
                <p
                  className={`mt-3 text-lg font-bold ${
                    isDark ? "text-white" : tone ? tone.credit : "text-gray-900"
                  }`}
                >
                  {config.credits.toLocaleString()} credits / month
                </p>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {creditReplyCalculator(config.credits)}
                </p>
                <p
                  className={`mt-1 text-[11px] leading-snug ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {CREDITS_RESET_DISCLAIMER}
                </p>
                {config.bonusCredits > 0 && (
                  <p
                    className={`mt-2 inline-flex rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                      isDark
                        ? "bg-[#FF6600] text-white"
                        : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    }`}
                  >
                    {bonusCreditsBadge(config.bonusCredits)}
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
                {cardFeatures(config).map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check
                      className={`h-3.5 w-3.5 ${
                        isDark ? "text-gray-400" : tone ? tone.check : "text-gray-400"
                      }`}
                    />
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
