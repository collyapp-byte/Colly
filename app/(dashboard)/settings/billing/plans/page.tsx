"use client";

import { useState } from "react";
import { Check, Star, Zap } from "lucide-react";
import {
  TELEGRAM_PLANS,
  WHATSAPP_PLANS,
  type Channel,
  type PlanConfig,
  type PlanInterval,
  type TelegramPlanTier,
  type WhatsappPlanTier,
} from "@/lib/plans";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";

const TELEGRAM_TIERS: TelegramPlanTier[] = ["green", "blue", "black"];
const WHATSAPP_TIERS: WhatsappPlanTier[] = ["starter", "business", "pro"];

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

const WHATSAPP_META: Record<WhatsappPlanTier, CardMeta> = {
  starter: { name: "Starter", tagline: "For solo sellers getting started" },
  business: {
    name: "Business",
    tagline: "For growing businesses",
    badge: "Most Popular",
    featured: true,
  },
  pro: { name: "Pro", tagline: "For high-volume stores" },
};

/** The bullet list under a card. Message counts come from the plan config. */
function cardFeatures(
  tier: string,
  channel: Channel,
  config: PlanConfig,
): string[] {
  const messages =
    config.includedMsgs >= UNLIMITED
      ? "Unlimited Messages"
      : `${config.includedMsgs.toLocaleString()} AI replies/month`;
  const manual =
    config.includedManualMessages >= UNLIMITED
      ? "Unlimited manual replies"
      : `${config.includedManualMessages.toLocaleString()} manual replies/month`;

  if (channel === "TELEGRAM") {
    if (tier === "green") {
      return [messages, manual, "Telegram bot connection", "Product catalogue", "FAQ knowledge base"];
    }
    if (tier === "blue") {
      return [messages, manual, "Everything in Green", "Analytics", "Priority support"];
    }
    return [messages, manual, "Everything in Blue", "Dedicated support", "Advanced analytics"];
  }

  if (tier === "starter") {
    return [messages, manual, "1 WhatsApp number", "Product catalogue", "FAQ knowledge base"];
  }
  if (tier === "business") {
    return [messages, manual, "3 WhatsApp numbers", "Everything in Starter", "Analytics"];
  }
  return [messages, manual, "10 WhatsApp numbers", "Everything in Business", "Dedicated support"];
}

export default function PlansPage() {
  const [channel, setChannel] = useState<Channel>("TELEGRAM");
  const [interval, setInterval] = useState<PlanInterval>("monthly");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(tier: string, chosenInterval: PlanInterval) {
    setCheckingOut(`${tier}-${chosenInterval}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, tier, interval: chosenInterval }),
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

  const isTelegram = channel === "TELEGRAM";
  const tiers: string[] = isTelegram ? TELEGRAM_TIERS : WHATSAPP_TIERS;
  const plans = (isTelegram ? TELEGRAM_PLANS : WHATSAPP_PLANS) as Record<
    string,
    PlanConfig
  >;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col items-center">
        <h1 className="mt-4 text-center font-display text-2xl font-bold text-gray-900">
          Choose a plan
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">
          We recommend Telegram: cheaper per reply, with no monthly WhatsApp fees
          from Meta.
        </p>
      </div>

      {/* CHANNEL TOGGLE */}
      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-full border bg-white p-1">
          <button
            type="button"
            onClick={() => setChannel("TELEGRAM")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isTelegram
                ? "bg-[#16A34A] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span aria-hidden>📱</span>
            Telegram
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isTelegram
                  ? "bg-white/20 text-white"
                  : "bg-green-100 text-green-700"
              }`}
            >
              Recommended
            </span>
          </button>
          <button
            type="button"
            onClick={() => setChannel("WHATSAPP")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !isTelegram
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span aria-hidden>💬</span>
            WhatsApp
          </button>
        </div>
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

      {/* PLAN CARDS */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => {
          const config = plans[tier];
          const price = interval === "monthly" ? config.monthly : config.yearly;
          const yearlySaving = config.monthly * 12 - config.yearly;
          const meta: CardMeta = isTelegram
            ? TELEGRAM_META[tier as TelegramPlanTier]
            : WHATSAPP_META[tier as WhatsappPlanTier];
          const isDark = Boolean(meta.dark);
          const isFeatured = Boolean(meta.featured);
          const Icon = isFeatured || isDark ? Star : Zap;

          const cardClasses = isDark
            ? "border-2 border-gray-900 bg-gray-900 text-white"
            : isFeatured
              ? "border-2 border-[#FF6600] bg-[#FFF4EC]"
              : "border border-gray-200 bg-white";

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
                {cardFeatures(tier, channel, config).map((feature) => (
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
