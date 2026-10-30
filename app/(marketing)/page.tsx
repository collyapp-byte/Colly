import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { ProblemSection } from "@/components/marketing/problem-section";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FounderAndCTA } from "@/components/marketing/founder-and-cta";
import { HomepageJsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_TITLE_DEFAULT } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  // The home title already carries the brand, so it skips the root template.
  title: SITE_TITLE_DEFAULT,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
  keywords: [...SITE_KEYWORDS],
});

export default function MarketingPage() {
  return (
    <>
      {/* Structured data renders first: `<main>` is the marketing layout's
          wrapper, so this <script> is the first element inside it. The product
          node is assembled in `lib/seo.ts` from `lib/plans.ts`, and `<FAQ />`
          emits its own FAQPage from `lib/marketing-faq.ts`, so neither can
          quote a stale price or an answer the page does not show. */}
      <HomepageJsonLd />
      {/* Everything below the hero is imported statically on purpose.
          These sections are Server Components — their copy, icons and JSON-LD
          ship as prerendered HTML and only their two animation primitives
          (`ScrollReveal`, `TiltCard`) add client JS — so `next/dynamic` would
          buy nothing: with `ssr: false` the sections would arrive after
          hydration (a fresh layout shift plus crawler-invisible content, and
          this page exists for answer engines), and with the default `ssr` the
          same chunks are still requested during load. The initial bundle was cut
          where it actually mattered instead: framer-motion (~78KB minified,
          ~27KB gzipped) no longer reaches this route. Its last user, the
          dashboard's `AnimatedCounter`, is a plain rAF loop now, so the
          dependency is gone from the app — and the hero stays a plain static
          import so the LCP element is in the first paint. */}
      <Hero />
      <ProblemSection />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FounderAndCTA />
    </>
  );
}


