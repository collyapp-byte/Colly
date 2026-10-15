import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

export default function OnboardingExpiredPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-[1000px]">
        <div className="flex flex-col items-center">
          <span className="inline-flex items-center rounded-full bg-[#FFF4EC] px-3 py-1 text-[11px] uppercase tracking-wider text-[#FF6600]">
            SETUP WINDOW ENDED
          </span>
          <h1 className="mt-4 text-center font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Your onboarding window has ended
          </h1>
          <p className="mt-2 text-center text-sm text-gray-500">
            Your products and settings are saved. Choose a plan to keep Colly
            answering your customers.
          </p>
        </div>

        <div className="mx-auto mt-10 flex max-w-xl items-start gap-3 rounded-xl border border-gray-200 bg-white p-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-900">
              Your site access is always available
            </p>
            <p className="mt-1">
              You can still sign in, manage products and customers, chat
              manually and create invoices. Only AI auto-replies and NRS
              transmission are locked without a plan.
            </p>
            <p className="mt-2">
              Buy credits to try the AI without subscribing, or choose a plan
              for a monthly allowance.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/settings/billing/plans"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
              >
                Choose a plan
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/settings/billing/credits"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Buy credits
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
