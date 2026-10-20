import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Bolt,
  BookOpenCheck,
  MessageCircle,
  Send,
  Sparkles,
  UserRoundCog,
} from "lucide-react";
import { TELEGRAM_PLANS } from "@/lib/plans";
import { formatNaira } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: "Colly — The AI sales assistant for Telegram" },
  description:
    "Colly replies to your Telegram customers 24/7. Connect a bot in 30 seconds. No SIM cards, no Meta fees.",
};

/** The channels. WhatsApp is postponed until Meta verification clears. */
const CHANNEL_CARDS = [
  {
    name: "WhatsApp",
    icon: MessageCircle,
    iconClass: "bg-gray-200 text-gray-500",
    recommended: false,
    comingSoon: true,
    points: ["Coming soon — pending Meta business verification."],
  },
  {
    name: "Telegram",
    icon: Send,
    iconClass: "bg-[#FF6600]/10 text-[#FF6600]",
    recommended: true,
    comingSoon: false,
    points: [
      "2,000 messages / month",
      "₦10 per extra message",
      "No SIM card required",
      "Instant self-serve setup",
    ],
  },
] as const;

const STEPS = [
  {
    icon: UserRoundCog,
    title: "Connect your bot",
    body: "Create a Telegram bot with @BotFather and paste the token. It takes 30 seconds.",
  },
  {
    icon: BookOpenCheck,
    title: "Train your AI",
    body: "Add your products and FAQs once. Your assistant learns your prices, stock and policies.",
  },
  {
    icon: Bolt,
    title: "Watch it sell",
    body: "Your AI replies to every customer in seconds, day or night, in your business's tone.",
  },
] as const;

export default function MarketingHomePage() {
  const green = TELEGRAM_PLANS.green;
  const black = TELEGRAM_PLANS.black;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-[#FFF4EC] to-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6600]/20 bg-white px-3 py-1 text-[13px] font-medium text-[#FF6600]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Built for Nigerian businesses
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-3xl leading-tight tracking-tight text-gray-900 sm:text-5xl">
            Stop losing sales to unanswered Telegram messages.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-gray-600 sm:text-lg">
            Colly is the AI sales assistant for Telegram. Connect a bot in 30
            seconds. Zero SIM cards. 2,000+ messages.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="w-full rounded-lg bg-[#FF6600] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00] sm:w-auto"
            >
              Start Free Trial
            </Link>
            <Link
              href="/find-an-agent"
              className="w-full rounded-lg border border-gray-200 bg-white px-8 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
            >
              Find an Agent
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-gray-500">
            No SIM card required to start · Cancel anytime
          </p>
        </div>
      </section>

      {/* Channels */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl text-gray-900 sm:text-3xl">
            Start on Telegram today. WhatsApp is coming soon.
          </h2>
          <p className="mt-3 text-sm text-gray-600 sm:text-base">
            Telegram is instant, has no Meta fees, and needs no second SIM.
            WhatsApp plans will be available once we finish Meta verification.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {CHANNEL_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.name}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  card.recommended
                    ? "border-[#FF6600] ring-1 ring-[#FF6600]"
                    : "border-gray-200 opacity-80"
                }`}
              >
                {card.recommended && (
                  <span className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-[#FF6600] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Recommended
                  </span>
                )}
                {card.comingSoon && (
                  <span className="absolute -top-3 right-5 inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
                    Coming Soon
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3
                    className={`font-display text-lg ${
                      card.comingSoon ? "text-gray-500" : "text-gray-900"
                    }`}
                  >
                    {card.name}
                  </h3>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {card.points.map((point) => (
                    <li
                      key={point}
                      className={`flex items-start gap-2 text-sm ${
                        card.comingSoon ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          card.comingSoon ? "bg-gray-300" : "bg-[#FF6600]"
                        }`}
                        aria-hidden
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl text-gray-900 sm:text-3xl">
              Up and running in three steps
            </h2>
            <p className="mt-3 text-sm text-gray-600 sm:text-base">
              No technical setup, no new phone. Most businesses are answering
              customers with AI the same day.
            </p>
          </div>

          <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex flex-col items-start">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EC] text-[#FF6600]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="mt-4 text-[13px] font-semibold text-[#FF6600]">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-gray-600">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl text-gray-900 sm:text-3xl">
            Simple pricing, in Naira
          </h2>
          <p className="mt-3 text-sm text-gray-600 sm:text-base">
            Start with a free trial — no card required. Two of our Telegram
            plans below; every plan includes voice notes, image recognition and
            negotiation.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-display text-lg text-gray-900">
              Telegram Green
            </h3>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-3xl text-gray-900">
                {formatNaira(green.monthly)}
              </span>
              <span className="text-sm text-gray-500">/ month</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6600]"
                  aria-hidden
                />
                {green.includedMsgs.toLocaleString("en-NG")} messages included
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6600]"
                  aria-hidden
                />
                ₦{green.aiCredit} per extra AI reply
              </li>
            </ul>
            <Link
              href="/signup"
              className="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Start Free Trial
            </Link>
          </div>

          <div className="relative flex flex-col rounded-2xl border border-[#FF6600] bg-white p-6 ring-1 ring-[#FF6600]">
            <span className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-[#FF6600] px-2.5 py-0.5 text-[11px] font-semibold text-white">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Most capable
            </span>
            <h3 className="font-display text-lg text-gray-900">
              Telegram Black
            </h3>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-3xl text-gray-900">
                {formatNaira(black.monthly)}
              </span>
              <span className="text-sm text-gray-500">/ month</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6600]"
                  aria-hidden
                />
                Unlimited messages
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6600]"
                  aria-hidden
                />
                Priority support
              </li>
            </ul>
            <Link
              href="/signup"
              className="mt-6 rounded-lg bg-[#FF6600] px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
            >
              Start Free Trial
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Telegram only for now — WhatsApp plans are coming soon.{" "}
          <Link
            href="/signup?role=business"
            className="font-medium text-[#FF6600] transition-colors hover:text-[#E65C00]"
          >
            Get Started
          </Link>
        </p>
      </section>
    </>
  );
}
