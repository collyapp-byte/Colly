import Link from "next/link";
import { Check, Send } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#f5f5f5] pt-32 pb-20">
      {/* Soft warm glow behind the visual, kept subtle so the copy stays crisp. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-24 right-0 h-[28rem] w-[28rem] rounded-full bg-[#FF6600]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2">
        {/* Left column */}
        <ScrollReveal>
          <span className="inline-flex items-center rounded-full border border-[#FF6600]/30 bg-white px-4 py-1.5 text-[13px] font-semibold text-[#FF6600]">
            Colly AI 2.0 is live
          </span>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-gray-900 lg:text-7xl">
            Your AI sales assistant for{" "}
            <span className="text-[#FF6600]">Nigerian businesses.</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg text-gray-600">
            Stop losing sales to missed replies. Colly replies 24/7 in English or
            Pidgin, quotes prices, and sends product images.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?role=business"
              className="inline-flex items-center justify-center rounded-xl bg-[#FF6600] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#E65C00]"
            >
              Start Free Trial
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-7 py-3.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              See how it works
            </Link>
          </div>

          <p className="mt-4 text-[13px] text-gray-500">
            No SIM card required to start · Cancel anytime
          </p>
        </ScrollReveal>

        {/* Right column: CSS-only chat mockup */}
        <ScrollReveal delay={0.15} className="relative mx-auto w-full max-w-sm">
          <div className="absolute -left-2 bottom-16 z-10 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl sm:-left-10">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-gray-500">Sale Closed</p>
              <p className="text-sm font-bold text-gray-900">₦15,000</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF6600] text-sm font-bold text-white">
                C
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Colly AI</p>
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Online now
                </p>
              </div>
            </div>

            <div className="space-y-4 bg-white px-5 py-6">
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm text-gray-700">
                How much is the Samsung Galaxy A15?
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#FF6600] px-4 py-3 text-sm text-white">
                The Samsung Galaxy A15 is ₦185,000. It has 128GB storage, 4GB
                RAM, and a 50MP camera. Want to see pictures?
              </div>
              <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm text-gray-700">
                Yes please
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
              <div className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-xs text-gray-400">
                Type a message...
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6600] text-white">
                <Send className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
