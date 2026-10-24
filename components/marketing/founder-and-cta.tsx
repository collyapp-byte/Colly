import Link from "next/link";

export function FounderAndCTA() {
  return (
    <>
      <section className="bg-[#f5f5f5] py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gray-300 text-gray-500 text-2xl font-bold shadow-inner">
            BI
          </div>
          <h2 className="font-display text-2xl font-bold text-gray-900">Built by Bryan Ifeanyi</h2>
          <p className="mt-4 text-lg text-gray-600 italic leading-relaxed">
            &quot;As a Nigerian CS student, I got tired of watching brilliant
            businesses lose money simply because they couldn&apos;t reply to
            messages fast enough. We built Colly so you can keep your personal
            phone, add a dedicated AI line, and never lose a sale again.&quot;
          </p>
        </div>
      </section>

      <section className="bg-white py-20 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">Ready to stop losing sales?</h2>
          <p className="mt-4 text-gray-600 mb-8">Set up your AI receptionist in 5 minutes. 50 AI messages free for 7 days. No card required.</p>
          <Link
            href="/signup?role=business"
            className="inline-block rounded-lg bg-[#FF6600] px-8 py-4 text-base font-semibold text-white transition-all hover:scale-105 hover:bg-[#E65C00] active:scale-95 shadow-lg shadow-orange-500/20"
          >
            Start Your Free Trial
          </Link>
        </div>
      </section>
    </>
  );
}
