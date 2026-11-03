"use client";

import Link from "next/link";
import { Award, CheckCircle2, Gift, Wallet } from "lucide-react";

export default function CertifiedPage() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-50 via-white to-orange-50 p-8 shadow-sm">
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-green-100/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-orange-100/40 blur-3xl" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50">
          <CheckCircle2 className="h-14 w-14 text-green-600" aria-hidden />
        </div>

        <h1 className="mt-6 font-display text-3xl tracking-tight text-gray-900 sm:text-4xl">
          You are officially a Certified Colly Agent! 🎉
        </h1>

        <p className="mt-4 max-w-2xl text-base text-gray-600 sm:text-lg">
          Your profile is now live on the Find an Agent directory. Businesses in
          your state can contact you directly.
        </p>

        <div className="mt-8 w-full rounded-2xl border border-green-200 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100">
              <Gift className="h-6 w-6 text-orange-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Earn recurring commission
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
                You earn <strong>15% recurring commission</strong> on every
                business you onboard. This lasts for{" "}
                <strong>exactly 12 months</strong>. Your payout is processed
                instantly via Paystack.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 w-full rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">Next steps</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/agents/wallet"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-colly px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
            >
              <Wallet className="h-4 w-4" aria-hidden />
              Setup your Payout Wallet
            </Link>
            <Link
              href="/agents/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Award className="h-4 w-4" aria-hidden />
              Go to Dashboard
            </Link>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Congratulations on completing Colly Agent Certification!
        </p>
      </div>
    </div>
  );
}
