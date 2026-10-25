import Link from "next/link";
import { Check } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { TiltCard } from "@/components/ui/tilt-card";
import {
  CREDIT_ECONOMY_DESCRIPTION,
  PLANS,
  creditReplyCalculator,
} from "@/lib/plans";
import { formatNaira } from "@/lib/format";

export function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "₦0",
      desc: "For testing the waters.",
      credits: 0,
      features: ["Unlimited manual replies", "Dashboard inbox", "Product catalogue"],
      cta: "Start Free",
      href: "/signup?role=business",
      highlight: false
    },
    {
      name: "Green",
      price: formatNaira(PLANS.green.monthly),
      desc: PLANS.green.description,
      credits: PLANS.green.credits,
      features: ["Telegram, Discord & Web Chat", "5 credits per Telegram reply", "40 credits per WhatsApp reply", "All AI features", "Owner alerts"],
      cta: "Get Green",
      href: "/signup?role=business&plan=green",
      highlight: true
    },
    {
      name: "Blue",
      price: formatNaira(PLANS.blue.monthly),
      desc: PLANS.blue.description,
      credits: PLANS.blue.credits,
      features: ["Telegram, Discord & Web Chat", "5 credits per Telegram reply", "40 credits per WhatsApp reply", "All AI features", "Priority support"],
      cta: "Get Blue",
      href: "/signup?role=business&plan=blue",
      highlight: false
    },
    {
      name: "Black",
      price: formatNaira(PLANS.black.monthly),
      desc: PLANS.black.description,
      credits: PLANS.black.credits,
      features: ["Telegram, Discord & Web Chat", "5 credits per Telegram reply", "40 credits per WhatsApp reply", "Unlimited manual replies", "Dedicated onboarding"],
      cta: "Get Black",
      href: "/signup?role=business&plan=black",
      highlight: false
    }
  ];

  return (
    <section id="pricing" className="bg-white/60 py-20 sm:py-28">
      <ScrollReveal className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">Simple pricing. No hidden fees.</h2>
          <p className="mt-4 text-gray-600">Billed monthly. Cancel anytime.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">{CREDIT_ECONOMY_DESCRIPTION}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <TiltCard key={plan.name} className={`flex flex-col p-6 ${plan.highlight ? 'border border-[#FF6600] bg-white shadow-lg' : 'bg-white/60 backdrop-blur-md border border-white/50 shadow-lg rounded-2xl'}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#FF6600] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Most Popular</div>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500">{plan.desc}</p>
              </div>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-500">/mo</span>
                {plan.credits > 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {creditReplyCalculator(plan.credits)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    Manual replies are always free
                  </p>
                )}
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-[#FF6600]" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-transform active:scale-95 ${plan.highlight ? 'bg-[#FF6600] text-white hover:bg-[#E65C00]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
              >
                {plan.cta}
              </Link>
            </TiltCard>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
