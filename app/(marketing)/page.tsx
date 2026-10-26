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
          and FAQ nodes are assembled in `lib/seo.ts` from `lib/plans.ts` and
          `lib/marketing-faq.ts`, so the rich snippet can never quote a stale
          price or an answer the page does not show. */}
      <HomepageJsonLd />
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

