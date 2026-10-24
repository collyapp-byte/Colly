import Link from "next/link";
import Image from "next/image";
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

        {/* Right column: customer conversation image */}
        <ScrollReveal delay={0.15} className="relative w-full">
          <Image
            src="/man chatting daytime v.jpg"
            alt="Business owner chatting with a customer through Colly AI"
            width={900}
            height={700}
            priority
            className="rounded-3xl shadow-2xl object-cover w-full h-[400px] lg:h-[500px] object-center border border-gray-100"
          />
        </ScrollReveal>
      </div>
    </section>
  );
}
