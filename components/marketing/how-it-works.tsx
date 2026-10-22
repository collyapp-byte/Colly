import { Bot, QrCode, Zap } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function HowItWorks() {
  const steps = [
    {
      icon: <QrCode className="h-8 w-8 text-[#FF6600]" />,
      title: "1. Connect your Telegram",
      desc: "Create a bot on BotFather, paste the token into Colly. No SIM card, no Meta approval, no CAC needed."
    },
    {
      icon: <Bot className="h-8 w-8 text-[#FF6600]" />,
      title: "2. AI learns your store",
      desc: "Add your products, prices, and FAQs. Colly learns your tone, your floor prices, and your delivery rules."
    },
    {
      icon: <Zap className="h-8 w-8 text-[#FF6600]" />,
      title: "3. Watch it close sales",
      desc: "Customers ask questions in English or Pidgin. Colly replies instantly, quotes prices, and alerts you for waybills."
    }
  ];

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4">
        <ScrollReveal className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">How Colly works</h2>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">Set it up in 5 minutes. Keep your personal number safe.</p>
        </ScrollReveal>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="relative rounded-2xl border border-gray-100 bg-[#f5f5f5] p-8 transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 inline-flex rounded-xl bg-white p-3 shadow-sm">{step.icon}</div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">{step.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
