"use client";

import { Lottie } from "@/components/ui/lottie";

export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Connect your Telegram",
      description: "Create a bot on BotFather and paste the token into Colly. No SIM card, no Meta approval, no CAC needed.",
      lottie: "/how-it-works-telegram.json",
    },
    {
      number: "02",
      title: "AI learns your store",
      description: "Add your products, prices, and FAQs. Colly learns your tone, your floor prices, and your delivery rules.",
      lottie: "/how-it-works-brain.json",
    },
    {
      number: "03",
      title: "Watch it close sales",
      description: "Customers ask in English or Pidgin. Colly replies instantly, quotes prices, and alerts you for waybills.",
      lottie: "/how-it-works-cash.json",
    },
  ];

  return (
    <section id="how-it-works" className="bg-white py-20 sm:py-28 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            How Colly works
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Set it up in 5 minutes. Keep your personal number safe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gray-100 z-0" />

          {steps.map((step, index) => (
            <div key={index} className="relative z-10 flex flex-col items-center text-center">
              <div className="text-7xl font-bold text-gray-200 mb-4 font-display tracking-tighter">
                {step.number}
              </div>
              
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#FFF4EC] mb-6 shadow-sm border border-[#FF6600]/10">
                <div className="h-16 w-16">
                  <Lottie src={step.lottie} />
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-3">
                {step.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}