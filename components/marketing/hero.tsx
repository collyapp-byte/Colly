import Link from "next/link";
import type { ReactNode } from "react";
import { formatNaira } from "@/lib/format";
import { CheckCircle2, MessageSquare, Send } from "lucide-react";

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
    <section className="relative overflow-hidden bg-white pt-28 pb-16 sm:pt-36 sm:pb-24">
      {/* Subtle background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFF4EC]/60 to-white" aria-hidden />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
        
        {/* Left Column: Stripe-style typography */}
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

        {/* Right Column: Product UI Mockup instead of Stock Photo */}
                {/* Right Column: Product UI Mockup instead of Stock Photo */}
        <div className="relative mx-auto w-full max-w-[340px] lg:max-w-[360px]">
          <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-tr from-orange-100 to-purple-50 opacity-50 blur-2xl" aria-hidden />
          
          {/* Phone Frame */}
          <div className="relative aspect-[9/19] w-full rounded-[2.5rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl overflow-hidden flex flex-col">
            
            {/* Notch / Dynamic Island */}
            <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-30">
              <div className="w-24 h-5 bg-gray-900 rounded-b-2xl"></div>
            </div>

            {/* Telegram Header */}
            <div className="flex items-center gap-3 bg-[#2AABEE] px-4 pt-8 pb-3 text-white shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">ABC Electronics</p>
                <p className="text-[11px] text-white/80">bot</p>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[#E7EBF0] p-4 flex flex-col gap-3 overflow-y-auto">
              
              {/* Customer Message */}
              <div className="self-end max-w-[85%] rounded-2xl rounded-tr-sm bg-[#E1FFC7] px-3 py-2 text-[13px] text-gray-900 shadow-sm">
                Wagwan, how much be this iPhone 12?
                <span className="block text-right text-[9px] text-gray-500 mt-1">10:42 AM</span>
              </div>

              {/* AI Message */}
              <div className="self-start max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[13px] text-gray-900 shadow-sm">
                <p>The iPhone 12 is <strong>{formatNaira(350000)}</strong>. We get am in stock. You want make I send you picture?</p>
                <span className="block text-right text-[9px] text-gray-500 mt-1">10:42 AM</span>
              </div>

              {/* Customer Message */}
              <div className="self-end max-w-[85%] rounded-2xl rounded-tr-sm bg-[#E1FFC7] px-3 py-2 text-[13px] text-gray-900 shadow-sm">
                Yes, send pic.
                <span className="block text-right text-[9px] text-gray-500 mt-1">10:43 AM</span>
              </div>

              {/* AI Image Message */}
              <div className="self-start max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-1 shadow-sm">
                <div className="h-28 w-40 rounded-xl bg-gray-200 flex items-center justify-center overflow-hidden">
                   <span className="text-[10px] text-gray-400">Product Image</span>
                </div>
                <p className="px-2 py-1.5 text-[13px] text-gray-900">iPhone 12 · {formatNaira(350000)}</p>
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white px-3 py-3 flex items-center gap-2 border-t border-gray-200 shrink-0">
              <div className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-[13px] text-gray-400">Message...</div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2AABEE] text-white shrink-0">
                <Send className="h-4 w-4 -ml-0.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}