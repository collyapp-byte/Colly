import Link from "next/link";
import { MessageCircle } from "lucide-react";

export function WhatsAppSection() {
  return (
    <section className="bg-[#1E3A8A]/90 py-16 text-white backdrop-blur-md sm:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-blue-100">
          <MessageCircle className="h-4 w-4" /> Coming Soon
        </div>
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Connect WhatsApp to Colly
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-blue-100">
          We are currently in the final stages of Meta business verification.
          WhatsApp will be available soon. For now, Telegram remains the fastest
          option with no SIM card and no Meta approval.
        </p>
        <Link
          href="/signup?role=business"
          className="mt-8 inline-flex rounded-lg bg-[#FF6600] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
        >
          Get Started
        </Link>
      </div>
    </section>
  );
}
