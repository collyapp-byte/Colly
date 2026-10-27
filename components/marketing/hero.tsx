import Link from "next/link";
import Image from "next/image";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { PLANS } from "@/lib/plans";
import { formatNaira } from "@/lib/format";

/**
 * Answer-first (BLUF) hero copy.
 *
 * The first screen states what Colly is, who it is for, the live channels and
 * the entry price in one self-contained paragraph, so an AI search engine
 * (ChatGPT, Perplexity, Google AI Overviews) can quote it verbatim without
 * needing the rest of the page. Price and credit figures are read from
 * `lib/plans.ts`, the single source of truth, so this answer can never
 * advertise a price the billing code does not charge.
 */
const HERO_ANSWER =
  "Colly is an AI sales assistant that replies to customers 24/7 on Telegram, Discord, and Web Chat. " +
  `It costs ${formatNaira(PLANS.green.monthly)}/month for ${PLANS.green.credits.toLocaleString()} credits, with a free tier available. ` +
  "It handles Pidgin, voice notes, and price negotiations so you never lose a sale.";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#f5f5f5] pt-8 pb-16 sm:pt-32 sm:pb-24">
      {/* Soft warm glow behind the visual, kept subtle so the copy stays crisp. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-24 right-0 h-[28rem] w-[28rem] rounded-full bg-[#FF6600]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2">
        {/* Left column — above the fold: `immediate` keeps the h1 in the server
            HTML as visible text so the LCP element does not wait for hydration. */}
        <ScrollReveal immediate>
          <span className="inline-flex items-center rounded-full border border-[#FF6600]/30 bg-white px-4 py-1.5 text-[13px] font-semibold text-[#FF6600]">
            Colly AI 2.0 is live
          </span>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-gray-900 lg:text-7xl">
            AI Sales Assistant for{" "}
            <span className="text-[#FF6600]">Nigerian Businesses</span>
          </h1>

          {/* Bottom line first: what it is, where it replies, what it costs. */}
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
            {HERO_ANSWER}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?role=business"
              className="inline-flex items-center justify-center rounded-xl bg-[#FF6600] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#E65C00]"
            >
              Start Free
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

        {/* Right column: customer conversation image. Also `immediate`: this is
            the largest element on the page, so a hidden initial state would
            postpone LCP even with the <link rel="preload"> in the head. */}
        <ScrollReveal immediate className="relative mt-8 w-full lg:mt-0">
          <Image
            src="/man chatting daytime v.jpg"
            alt="Business owner chatting with a customer through Colly AI"
            width={900}
            height={700}
            /* LCP element. `preload` inserts <link rel="preload"> in <head> so the
               hero asset starts downloading before the parser reaches the tag.
               Next.js 16 deprecated `priority` (same behaviour, ambiguous name),
               so this is the v16 spelling — do not add `priority` back. */
            preload
            /* Full-bleed until the wrapper switches to `lg:grid-cols-2` (Tailwind
               lg = 1024px), then half of the grid. The breakpoint matches the
               layout so tablets (769–1023px) still request a full-width
               candidate instead of a blurry 50vw one. `sizes` also switches
               Next's srcset to a full responsive set; without it the browser
               assumes 100vw and requests an oversized candidate on desktop. */
            sizes="(max-width: 1023px) 100vw, 50vw"
            className="rounded-3xl shadow-2xl object-cover w-full aspect-[4/5] lg:aspect-auto lg:h-[500px] object-center border border-gray-100"
          />
        </ScrollReveal>
      </div>
    </section>
  );
}
