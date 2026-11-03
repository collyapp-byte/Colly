import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, FREE_PLAN_LIMITS } from "@/lib/plans";
import { formatNaira } from "@/lib/format";
import { industrySlug, type Industry } from "@/lib/business";

// Helper to calculate replies (5 credits = 1 reply)
const calcReplies = (credits: number) => Math.floor(credits / 5).toLocaleString();

type PlanCard = {
  name: string;
  price: string;
  desc: string;
  replies: string;
  features: string[];
  cta: string;
  href: string;
  highlight: boolean;
};

export function Pricing({
  industry,
}: {
  place?: string;
  industry?: Industry;
} = {}) {
  const industryParam = industry ? `&industry=${industrySlug(industry)}` : "";
  const signupHref = `/signup?role=business${industryParam}`;

  const plans: PlanCard[] = [
    {
      name: "Free",
      price: formatNaira(0),
      desc: "For trying things out.",
      replies: calcReplies(FREE_PLAN_LIMITS.credits),
      features: [
        "16 AI Replies / month",
        "Unlimited manual replies",
        "Dashboard inbox",
        "Product catalogue",
      ],
      cta: "Start Free",
      href: signupHref,
      highlight: false,
    },
    {
      name: "Green",
      price: formatNaira(PLANS.green.monthly),
      desc: "For small boutiques and vendors getting started.",
      replies: calcReplies(PLANS.green.credits),
      features: [
        `${calcReplies(PLANS.green.credits)} AI Replies / month`,
        "Telegram, Discord & Web Chat",
        "All AI features",
        "Owner alerts",
      ],
      cta: "Get Green",
      href: `${signupHref}&plan=green`,
      highlight: false,
    },
    {
      name: "Blue",
      price: formatNaira(PLANS.blue.monthly),
      desc: "For growing shops replying to customers all day.",
      replies: calcReplies(PLANS.blue.credits),
      features: [
        `${calcReplies(PLANS.blue.credits)} AI Replies / month`,
        "Everything in Green",
        "Priority support",
      ],
      cta: "Get Blue",
      href: `${signupHref}&plan=blue`,
      highlight: true,
    },
    {
      name: "Black",
      price: formatNaira(PLANS.black.monthly),
      desc: "For high-volume wholesalers and teams.",
      replies: calcReplies(PLANS.black.credits),
      features: [
        `${calcReplies(PLANS.black.credits)} AI Replies / month`,
        "Everything in Blue",
        "Dedicated onboarding",
      ],
      cta: "Get Black",
      href: `${signupHref}&plan=black`,
      highlight: false,
    }
  ];

  return (
    <section id="pricing" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Simple pricing. No hidden fees.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Billed monthly. Cancel anytime.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            1 AI Reply = 5 Credits. Unused plan credits reset every month, but top-ups never expire.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl p-8 ${
                plan.highlight
                  ? "border-2 border-[#FF6600] bg-[#FFF4EC] shadow-xl"
                  : "border border-gray-200 bg-white shadow-sm"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#FF6600] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Most Popular
                </span>
              )}
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-gray-600 min-h-[40px]">{plan.desc}</p>
              </div>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-sm font-medium text-gray-500">/mo</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#FF6600]">
                  {plan.replies} AI Replies / month
                </p>
              </div>
              
              <ul className="mb-8 flex-1 space-y-4">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check className="h-4 w-4 shrink-0 text-[#FF6600] mt-0.5" /> 
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              
              <Link
                href={plan.href}
                className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition-all ${
                  plan.highlight
                    ? "bg-[#FF6600] text-white hover:bg-[#E65C00]"
                    : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        
      </div>
    </section>
  );
}