import { Hero } from "@/components/marketing/hero";
import { Marquee } from "@/components/ui/marquee";
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
      <Marquee />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <WhatsAppSection />
      <FounderAndCTA />
    </main>
  );
}
