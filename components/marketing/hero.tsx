import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Lottie } from "@/components/ui/lottie";

export function Hero({
  place,
  across = false,
  badge,
  heading,
  subhead,
  ctaHref = "/signup?role=business",
  ctaLabel = "Start Free",
  secondaryHref,
  secondaryLabel,
  footnote = "No credit card required · 80 free credits",
}: {
  place?: string;
  across?: boolean;
  badge?: string;
  heading?: ReactNode;
  subhead?: string;
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  footnote?: string;
} = {}) {
  
  const defaultHeading = place ? (
    <>AI Sales Assistant for Businesses in <span className="text-[#FF6600]">{place}</span></>
  ) : (
    <>AI Sales Assistant for <span className="text-[#FF6600]">Nigerian Businesses</span></>
  );

  const defaultSubhead = place
    ? `Colly AI helps ${across ? `businesses across ${place}` : `${place} businesses`} reply to customers 24/7 on Telegram and Web Chat without missing a sale.`
    : "Reply to customers 24/7 on Telegram, Discord, and Web Chat. Never lose a sale again.";

  return (
    <section className="relative overflow-hidden bg-white pt-16 pb-12 sm:pt-24 sm:pb-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFF4EC]/60 to-white" aria-hidden />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
        
        <div>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-[#FF6600]/30 bg-white px-4 py-1.5 text-[13px] font-semibold text-[#FF6600] mb-6">
              {badge}
            </span>
          )}

          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl leading-[1.1]">
            {heading ?? defaultHeading}
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-600">
            {subhead ?? defaultSubhead}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={ctaHref}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-[#FF6600] px-8 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
            >
              {ctaLabel}
            </Link>
            <Link
              href={secondaryHref ?? "#how-it-works"}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-8 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              {secondaryLabel ?? "See how it works"}
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            {footnote}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
          <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-tr from-orange-100 to-purple-50 opacity-50 blur-2xl" aria-hidden />
          <div className="relative">
            <Lottie src="/hero-chat-typing.json" />
          </div>
        </div>

      </div>
    </section>
  );
}