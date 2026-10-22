export function FAQ() {
  const faqs = [
    {
      q: "Will it embarrass me by quoting the wrong price?",
      a: "No. Colly is strictly constrained by the floor prices and rules you set. It will never negotiate below your limit. If a customer asks for something complex like a custom waybill, Colly instantly alerts you to take over."
    },
    {
      q: "My customers use WhatsApp, not Telegram.",
      a: "You can connect your own WhatsApp API account to Colly now, though it requires a Meta business account and completed API setup. Telegram remains the fastest option because it needs no SIM card, no Meta approval, and has zero message fees."
    },
    {
      q: "₦15,000 is too much.",
      a: "It costs less than a part-time staff, but it works 24/7, doesn't sleep, and never misses a message. One saved sale usually covers the monthly subscription."
    },
    {
      q: "Why Telegram first?",
      a: "Telegram is still the fastest way to launch: it needs no SIM card, no Meta approval, and has zero message fees. Colly now supports the official WhatsApp API too, but connecting WhatsApp requires a Meta business account and completed WhatsApp API setup."
    }
  ];

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="font-display text-3xl font-bold text-center text-gray-900 mb-12">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="group rounded-xl border border-gray-200 bg-white p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900 outline-none">
                {faq.q}
                <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
