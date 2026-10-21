import { AudioLines, Banknote, ShieldAlert, Sparkles } from "lucide-react";

export function Features() {
  const features = [
    {
      icon: <AudioLines className="h-6 w-6 text-[#FF6600]" />,
      title: "Understands Pidgin & Voice Notes",
      desc: "Customer sends a voice note saying 'Wagwan, how much be this iPhone 12?' Colly understands, translates, and replies perfectly."
    },
    {
      icon: <ShieldAlert className="h-6 w-6 text-[#FF6600]" />,
      title: "Smart Escalation",
      desc: "Colly never guesses a waybill price. If a customer asks for delivery to Abuja, Colly instantly pings your personal Telegram to take over."
    },
    {
      icon: <Banknote className="h-6 w-6 text-[#FF6600]" />,
      title: "Never Quotes Below Your Floor",
      desc: "You set the limits. Colly can negotiate within your rules, but it will never sell at a loss or embarrass you on price."
    },
    {
      icon: <Sparkles className="h-6 w-6 text-[#FF6600]" />,
      title: "24/7 AI Receptionist",
      desc: "While you sleep, Colly is answering FAQs, checking stock, and closing sales. No breaks, no salary."
    }
  ];

  return (
    <section className="bg-[#f5f5f5] py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">Built for the Nigerian market</h2>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">Not a generic chatbot. A sales assistant that understands how we talk.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f, i) => (
            <div key={i} className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mt-1 shrink-0 rounded-lg bg-[#FFF4EC] p-2">{f.icon}</div>
              <div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
