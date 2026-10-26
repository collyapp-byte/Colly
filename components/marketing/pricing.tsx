import Link from "next/link";
import { Check } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { TiltCard } from "@/components/ui/tilt-card";
import {
  CREDIT_ECONOMY_DESCRIPTION,
  CREDITS_RESET_DISCLAIMER,
  FREE_PLAN_LIMITS,
  PLANS,
  REPLY_CREDIT_COSTS,
  bonusCreditsBadge,
  creditReplyCalculator,
} from "@/lib/plans";
import { formatNaira } from "@/lib/format";

/**
 * Every card carries its plan's accent colour in the credits figure and the
 * check marks, but only the highlighted plan gets a tinted background. Green,
 * Black and Free are plain white cards; Blue (the "Most Popular" plan) keeps
 * its light blue wash, a strong blue border and a deeper shadow so it stands
 * out without overlapping any text.
 */
type CardTone = "neutral" | "emerald" | "blue";

const CARD_TONES: Record<
  CardTone,
  { card: string; highlightCard: string; credit: string; check: string }
> = {
  neutral: {
    card: "border border-gray-200 bg-white shadow-sm",
    highlightCard: "border-2 border-[#FF6600] bg-[#FFF4EC] shadow-xl",
    credit: "text-[#FF6600]",
    check: "text-[#FF6600]",
  },
  emerald: {
    card: "border border-gray-200 bg-white shadow-sm",
    highlightCard: "border-2 border-emerald-600 bg-emerald-50/50 shadow-xl",
    credit: "text-emerald-700",
    check: "text-emerald-600",
  },
  blue: {
    card: "border border-blue-100 bg-blue-50/50 shadow-sm",
    highlightCard: "border-2 border-blue-600 bg-blue-50/50 shadow-xl shadow-blue-600/10",
    credit: "text-blue-700",
    check: "text-blue-600",
  },
};

type PlanCard = {
  name: string;
  price: string;
  desc: string;
  credits: number;
  bonusCredits: number;
  /** Free tier: shows the plan description instead of the reply calculator. */
  free?: boolean;
  features: string[];
  cta: string;
  href: string;
  highlight: boolean;
  tone: CardTone;
};

export function Pricing() {
  const plans: PlanCard[] = [
    {
      name: "Free",
      price: "₦0",
      desc: "Free forever. No card required.",
      credits: FREE_PLAN_LIMITS.credits,
      bonusCredits: 0,
      free: true,
      features: ["Unlimited manual replies", "Dashboard inbox", "Product catalogue"],
      cta: "Start Free",
      href: "/signup?role=business",
      highlight: false,
      tone: "neutral"
    },
    {
      name: "Green",
      price: formatNaira(PLANS.green.monthly),
      desc: PLANS.green.description,
      credits: PLANS.green.credits,
      bonusCredits: PLANS.green.bonusCredits,
      features: [PLANS.green.bonusDescription, "Telegram, Discord & Web Chat", `${REPLY_CREDIT_COSTS.standard} credits per Telegram reply`, `${REPLY_CREDIT_COSTS.whatsapp} credits per WhatsApp reply`, "All AI features", "Owner alerts"],
      cta: "Get Green",
      href: "/signup?role=business&plan=green",
      highlight: false,
      tone: "emerald"
    },
    {
      name: "Blue",
      price: formatNaira(PLANS.blue.monthly),
      desc: PLANS.blue.description,
      credits: PLANS.blue.credits,
      bonusCredits: PLANS.blue.bonusCredits,
      features: [PLANS.blue.bonusDescription, "Telegram, Discord & Web Chat", `${REPLY_CREDIT_COSTS.standard} credits per Telegram reply`, `${REPLY_CREDIT_COSTS.whatsapp} credits per WhatsApp reply`, "All AI features", "Priority support"],
      cta: "Get Blue",
      href: "/signup?role=business&plan=blue",
      highlight: true,
      tone: "blue"
    },
    {
      name: "Black",
      price: formatNaira(PLANS.black.monthly),
      desc: PLANS.black.description,
      credits: PLANS.black.credits,
      bonusCredits: PLANS.black.bonusCredits,
      features: [PLANS.black.bonusDescription, "Telegram, Discord & Web Chat", `${REPLY_CREDIT_COSTS.standard} credits per Telegram reply`, `${REPLY_CREDIT_COSTS.whatsapp} credits per WhatsApp reply`, "Unlimited manual replies", "Dedicated onboarding"],
      cta: "Get Black",
      href: "/signup?role=business&plan=black",
      highlight: false,
      tone: "neutral"
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
          {plans.map((plan) => {
            const tone = CARD_TONES[plan.tone];

            return (
              <TiltCard
                key={plan.name}
                className={`flex flex-col p-6 ${plan.highlight ? tone.highlightCard : tone.card}`}
              >
                {plan.highlight && (
                  <span className="mb-4 inline-block rounded-full bg-[#FF6600] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500">{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">/mo</span>
                  {plan.credits > 0 ? (
                    <>
                      <p className="mt-2 flex items-baseline gap-1.5">
                        <span className={`text-2xl font-extrabold ${tone.credit}`}>
                          {plan.credits.toLocaleString()}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Credits / month
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {plan.free
                          ? FREE_PLAN_LIMITS.description
                          : creditReplyCalculator(plan.credits)}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-gray-500">
                        {CREDITS_RESET_DISCLAIMER}
                      </p>
                      {plan.bonusCredits > 0 && (
                        <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          {bonusCreditsBadge(plan.bonusCredits)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      Manual replies are always free
                    </p>
                  )}
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className={`h-4 w-4 ${tone.check}`} /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-transform active:scale-95 ${plan.highlight ? "bg-[#FF6600] text-white hover:bg-[#E65C00]" : "border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200"}`}
                >
                  {plan.cta}
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </ScrollReveal>
    </section>
  );
}
