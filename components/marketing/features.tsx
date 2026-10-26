import Image from "next/image";
import {
  AudioLines,
  BellRing,
  ImageIcon,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { DEFAULT_MAX_ROUNDS } from "@/lib/negotiation";
import { REPLY_CREDIT_COSTS } from "@/lib/plans";

/**
 * Answer-first (BLUF) feature copy.
 *
 * Every card opens with one factual, quotable sentence ("Colly escalates …",
 * "Colly negotiates …") and only then adds the example, so an AI answer engine
 * can lift the first sentence as the answer to "does Colly understand Pidgin?",
 * "does it handle delivery questions?" or "can it negotiate price?". Replies,
 * rounds and credits come from the libraries that implement them.
 */
export function Features() {
  return (
    <section className="bg-white py-24">
      <ScrollReveal className="mx-auto max-w-7xl px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            One AI. Every channel. One limit.
          </h2>
          <p className="mt-4 text-gray-600">
            Colly replies to customers on Telegram, Discord, and Web Chat, and
            every channel draws from one shared credit balance:{" "}
            {REPLY_CREDIT_COSTS.standard} credits per AI reply,{" "}
            {REPLY_CREDIT_COSTS.whatsapp} credits on WhatsApp. Connect Telegram,
            Discord, and Web Chat yourself in minutes; WhatsApp is onboarded
            manually through a short waitlist.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1 — spans two columns */}
          <div className="rounded-3xl bg-[#1E3A8A] p-8 text-white md:col-span-2">
            <div className="flex h-full flex-col gap-8 md:flex-row md:items-center">
              <div className="md:w-1/2">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <AudioLines className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-2xl font-bold">
                  Nigerian Pidgin &amp; Voice Notes
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-blue-100">
                  Colly understands and speaks Nigerian Pidgin, English, and
                  processes voice notes natively. A customer can send a voice
                  note saying “Wagwan, how much be this iPhone 12?” and Colly
                  transcribes it, checks your product catalogue, and replies in
                  the same language with the real price, no typing required.
                </p>
              </div>

              <div className="md:w-1/2">
                <Image
                  src="/a screen with icons h.jpg"
                  alt="Colly AI understanding voice notes and Pidgin"
                  width={700}
                  height={500}
                  className="rounded-xl object-cover w-full h-[240px] md:h-[280px]"
                />
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl bg-orange-50 p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#FF6600] shadow-sm">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-6 text-xl font-bold text-gray-900">
              Smart Escalation to Your Telegram
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Colly escalates complex delivery or waybill questions to your
              personal Telegram immediately. If a customer asks for delivery to
              Abuja and you have not set a waybill price, Colly does not guess:
              it pauses the AI, alerts you with the customer’s question, and lets
              you reply as the human agent.
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2.5">
              <BellRing className="h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
              <span className="text-xs font-medium text-gray-700">
                Escalated to you
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl bg-gray-50 p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#FF6600] shadow-sm">
              <ImageIcon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-6 text-xl font-bold text-gray-900">
              Product Images on Request
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Colly sends real product images from your catalogue whenever a
              customer asks for a photo. It replies with the actual picture, the
              price, and whether the item is in stock, so you never dig through
              your phone gallery mid-conversation.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="flex aspect-square items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-300"
                >
                  <ImageIcon className="h-5 w-5" aria-hidden />
                </div>
              ))}
            </div>
          </div>

          {/* Card 4 — spans two columns */}
          <div className="rounded-3xl border border-gray-200 bg-white p-8 md:col-span-2">
            <div className="flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-center">
              <div className="max-w-sm">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6600]">
                  <Tag className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-2xl font-bold text-gray-900">
                  Price Negotiation That Never Loses You Money
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Colly negotiates price automatically but never below the floor
                  you set. You enter a list price and a floor price (for example
                  ₦185,000 list and ₦170,000 floor); Colly makes counter-offers
                  in small steps, stops after {DEFAULT_MAX_ROUNDS} rounds, and
                  refuses anything lower, so it never sells at a loss.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl border-2 border-dashed border-[#FF6600]/40 bg-orange-50 px-6 py-5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C2410C]">
                  List price
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  ₦185,000
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Floor: ₦170,000
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
