import { Hero } from "@/components/marketing/hero";
import { ProblemSection } from "@/components/marketing/problem-section";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FounderAndCTA } from "@/components/marketing/founder-and-cta";

export default function MarketingPage() {
  return (
    <main>
      <Hero />
      <ProblemSection />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FounderAndCTA />
    </main>
  );
}
