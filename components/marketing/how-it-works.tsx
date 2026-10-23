import { Bot, QrCode, Zap } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const STEPS = [
  {
    number: "01",
    icon: QrCode,
    title: "Connect your Telegram",
    desc: "Create a bot on BotFather and paste the token into Colly. No SIM card, no Meta approval, no CAC needed.",
  },
  {
    number: "02",
    icon: Bot,
    title: "AI learns your store",
    desc: "Add your products, prices, and FAQs. Colly learns your tone, your floor prices, and your delivery rules.",
  },
  {
    number: "03",
    icon: Zap,
    title: "Watch it close sales",
    desc: "Customers ask in English or Pidgin. Colly replies instantly, quotes prices, and alerts you for waybills.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-24">
      <ScrollReveal className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How Colly works
          </h2>
          <p className="mt-4 text-gray-600">
            Set it up in 5 minutes. Keep your personal number safe.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number}>
                <span className="block text-6xl font-bold tracking-tight text-gray-100">
                  {step.number}
                </span>
                <span className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6600]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold text-gray-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </ScrollReveal>
    </section>
  );
}
