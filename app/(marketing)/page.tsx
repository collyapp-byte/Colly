import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Features } from "@/components/marketing/features";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { WhatsAppSection } from "@/components/marketing/whatsapp-section";
import { FounderAndCTA } from "@/components/marketing/founder-and-cta";

export default function MarketingPage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <WhatsAppSection />
      <FounderAndCTA />
    </main>
  );
}
