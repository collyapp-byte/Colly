import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { ProblemSection } from "@/components/marketing/problem-section";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FounderAndCTA } from "@/components/marketing/founder-and-cta";
import { JsonLd } from "@/components/seo/json-ld";
import { faqJsonLd, pageMetadata, softwareApplicationJsonLd } from "@/lib/seo";
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
      {/* Product + FAQ markup: both read from lib/plans.ts and
          lib/marketing-faq.ts, so the rich snippet cannot quote a stale price
          or an answer the page does not show. */}
      <JsonLd data={softwareApplicationJsonLd()} />
      <JsonLd data={faqJsonLd()} />
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

