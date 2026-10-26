import type { Metadata } from "next";
import Link from "next/link";
import { Pricing } from "@/components/marketing/pricing";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, softwareApplicationJsonLd } from "@/lib/seo";
import { formatNaira } from "@/lib/format";
import {
  CREDITS_RESET_DISCLAIMER,
  CREDIT_ECONOMY_DESCRIPTION,
  FREE_PLAN_LIMITS,
  PLANS,
  REPLY_CREDIT_COSTS,
} from "@/lib/plans";

/**
 * Prices in the description are derived from `lib/plans.ts`, so the snippet a
 * search engine shows can never quote a price the checkout no longer charges.
 */
const PRICING_DESCRIPTION = `Colly pricing for Nigerian businesses: start free with ${FREE_PLAN_LIMITS.credits} AI credits every month, then ${formatNaira(PLANS.green.monthly)} (Green), ${formatNaira(PLANS.blue.monthly)} (Blue) or ${formatNaira(PLANS.black.monthly)} (Black) per month. 1 credit = ₦1, ${REPLY_CREDIT_COSTS.standard} credits per AI reply on Telegram, Discord and Web Chat, and manual replies are always free.`;

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description: PRICING_DESCRIPTION,
  path: "/pricing",
  keywords: [
    "Colly pricing",
    "AI sales bot price Nigeria",
    "Telegram bot subscription Nigeria",
    "customer service bot Naira",
  ],
});

export default function PricingPage() {
  return (
    <>
      {/* Itemised offers: one Offer per paid tier, priced from lib/plans.ts. */}
      <JsonLd data={softwareApplicationJsonLd({ itemisedOffers: true })} />

      <section className="pt-12 pb-2 sm:pt-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Pricing for Nigerian businesses
          </h1>
          <p className="mt-4 text-gray-600">
            Every plan replies on Telegram, Discord and Web Chat. Start free with{" "}
            {FREE_PLAN_LIMITS.credits} AI credits every month — no card and no SIM
            card needed — then move to a paid plan once the assistant is earning
            its keep.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            {CREDIT_ECONOMY_DESCRIPTION}
          </p>
        </div>
      </section>

      <Pricing />

      <section className="bg-white/60 pb-20 sm:pb-24">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Good to know
          </h2>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed text-gray-600">
            <li>
              <strong className="font-semibold text-gray-900">
                1 credit = ₦1.
              </strong>{" "}
              AI replies cost {REPLY_CREDIT_COSTS.standard} credits on Telegram,
              Discord and Web Chat, and {REPLY_CREDIT_COSTS.whatsapp} credits on
              WhatsApp. Replies you type yourself are free.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                Credits you buy never expire.
              </strong>{" "}
              {CREDITS_RESET_DISCLAIMER}
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                Telegram, Discord and Web Chat connect instantly.
              </strong>{" "}
              WhatsApp is onboarded from a manual waitlist because Meta requires a
              CAC certificate and a review.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                Prices are in Naira and billed through Paystack.
              </strong>{" "}
              Cancel any time from Settings; your plan runs to the end of the
              period you already paid for.
            </li>
          </ul>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?role=business"
              className="rounded-lg bg-[#FF6600] px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
            >
              Start free
            </Link>
            <Link
              href="/academy"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-900 transition-colors hover:border-gray-400"
            >
              Earn 15% by reselling Colly
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
