import Link from "next/link";
import { Check } from "lucide-react";

export function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "₦0",
      desc: "For testing the waters.",
      features: ["50 manual replies/mo", "0 AI messages", "Dashboard inbox"],
      cta: "Start Free",
      href: "/signup?role=business",
      highlight: false
    },
    {
      name: "Green",
      price: "₦15,000",
      desc: "For small boutiques & vendors.",
      features: ["2,000 AI messages/mo", "All AI features", "₦10/extra message", "Owner alerts"],
      cta: "Get Green",
      href: "/signup?role=business&plan=green",
      highlight: true
    },
    {
      name: "Blue",
      price: "₦25,000",
      desc: "For growing electronics shops.",
      features: ["6,000 AI messages/mo", "All AI features", "₦10/extra message", "Priority support"],
      cta: "Get Blue",
      href: "/signup?role=business&plan=blue",
      highlight: false
    },
    {
      name: "Black",
      price: "₦50,000",
      desc: "For high-volume wholesalers.",
      features: ["30,000 AI messages/mo", "Unlimited fair use", "₦10/extra message", "Dedicated onboarding"],
      cta: "Get Black",
      href: "/signup?role=business&plan=black",
      highlight: false
    }
  ];

  return (
    <section id="pricing" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">Simple pricing. No hidden fees.</h2>
          <p className="mt-4 text-gray-600">Billed monthly. Cancel anytime.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative flex flex-col rounded-2xl border p-6 ${plan.highlight ? 'border-[#FF6600] shadow-lg' : 'border-gray-200 shadow-sm'}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FF6600] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Most Popular</div>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500">{plan.desc}</p>
              </div>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-500">/mo</span>
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
