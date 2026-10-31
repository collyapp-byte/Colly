import type { Metadata } from "next";
import Link from "next/link";
import {
  BedDouble,
  CalendarCheck,
  Clock,
  Languages,
  ReceiptText,
  SearchCheck,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import {
  Features,
  type FeaturesContent,
} from "@/components/marketing/features";
import { Pricing } from "@/components/marketing/pricing";
import { FounderAndCTA } from "@/components/marketing/founder-and-cta";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, softwareApplicationJsonLd } from "@/lib/seo";
import { formatNaira } from "@/lib/format";
import { FREE_PLAN_LIMITS, PLANS, REPLY_CREDIT_COSTS } from "@/lib/plans";

/**
 * Hotel Management vertical landing page.
 *
 * `/hotels` is the vertical's front door. Its whole job is to hand a hotel owner
 * to `/signup?role=business&industry=hotel`, which stores `industry: "HOTEL"` on
 * the Business row; that flag is what turns the assistant into a receptionist
 * (lib/chat-engine.ts#HOTEL_PERSONA: ask for check-in AND check-out, then book).
 * So every call to action here carries the industry — a hotel that signs up from
 * this page must not land in the generic sales-assistant persona.
 *
 * Copy rules that come from the product, not from marketing taste:
 * - room rates are the hotel's own catalogue (`search_products`), never invented;
 * - bookings start PENDING and only the front desk confirms them;
 * - deposits are the saved bank details or a Paystack link, and a receipt becomes
 *   a DRAFT invoice the owner approves;
 * - WhatsApp is a manual waitlist, so it is never promised as self-serve.
 * Prices and credit counts are read from `lib/plans.ts`, so this page can never
 * advertise a price the checkout does not charge.
 */
const SIGNUP_HREF = "/signup?role=business&industry=hotel";

const HOTEL_DESCRIPTION =
  "Colly AI is a 24/7 AI receptionist for Nigerian hotels: it quotes your room rates, asks for check-in and check-out dates, and records the booking for your front desk on Telegram and Web Chat.";

export const metadata: Metadata = pageMetadata({
  title: "AI Receptionist for Nigerian Hotels",
  description: HOTEL_DESCRIPTION,
  path: "/hotels",
  keywords: [
    "AI receptionist for hotels Nigeria",
    "hotel chatbot Nigeria",
    "Telegram bot for hotels",
    "hotel booking automation Nigeria",
    "AI front desk Lagos",
    "guest house chatbot Nigeria",
  ],
});

/**
 * The hotel-specific benefits, listed before the shared feature grid.
 *
 * Each line is something the shipped product does: rates come from the room
 * list the owner imports, the stay is one booking with both dates, deposits are
 * the saved bank details or a Paystack link with the receipt filed as a draft,
 * and the assistant is the one that never confirms a room on the owner's behalf.
 */
const HOTEL_BENEFITS = [
  {
    icon: BedDouble,
    title: "Instant rate quotes",
    body: "Guests ask what a room costs at 11pm and get the real answer: Colly quotes the rate you set, names the room and says whether it is available — from your own room list, never from the model's imagination.",
  },
  {
    icon: Wallet,
    title: "Automated deposits",
    body: "When a guest is ready, Colly shares the bank details you saved or sends a secure Paystack payment link in the chat, then asks for the receipt so the deposit is on record before the room is held.",
  },
  {
    icon: CalendarCheck,
    title: "Check-in and check-out, one booking",
    body: "Hotel mode asks for both dates. Colly works out the nights, quotes the total and records the stay as one booking — check-in, check-out and nights — instead of a one-hour appointment slot.",
  },
  {
    icon: Languages,
    title: "Multilingual guest support",
    body: "English, Nigerian Pidgin and voice notes. A guest can send a voice note at midnight; it is transcribed, understood and answered in the same language, in the tone you picked for your hotel.",
  },
  {
    icon: Clock,
    title: "The 2am enquiry, answered",
    body: "Most room enquiries arrive after the front desk has closed. Colly replies instantly, day or night, on Telegram, Discord and Web Chat, and keeps the conversation warm until your team is back.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing confirmed without you",
    body: "The AI can quote a rate and take the details, but it can never promise a room. Every stay lands on the Bookings page as PENDING, and only your team confirms or cancels it.",
  },
];

/** The four feature cards, reusing the homepage grid's visual language. */
const HOTEL_FEATURES: FeaturesContent = {
  heading: "Built for the way a Nigerian hotel actually sells a room.",
  description:
    "A guest does not compare specifications — they ask what is free tonight and what it costs. Colly answers from your own rooms and rates, asks for the two dates that matter, and leaves the confirmation with your front desk.",
  cards: [
    {
      variant: "primary",
      icon: BedDouble,
      title: "Rate quotes from your own room list",
      body: "Your rooms are products: name, price, what is available. Colly checks that list before it says anything about money, so a guest hears the same rate your front desk would quote — and when a room is not in the list, it says so and hands the question to you instead of guessing.",
      pill: { icon: SearchCheck, label: "Rate checked in your room list" },
    },
    {
      variant: "warm",
      icon: Wallet,
      title: "Deposits, not promises",
      body: "Colly shares the payment details you saved, or a Paystack link, and asks the guest for the receipt. The picture is read by the vision pipeline and filed as a draft invoice with the amount, sender and reference attached.",
      pill: { icon: ReceiptText, label: "Receipt filed for approval" },
    },
    {
      variant: "muted",
      icon: CalendarCheck,
      title: "A stay, not a slot",
      body: "Both dates are required before anything is booked. The nights between them are written onto the booking, so your front desk sees 5 to 8 November and three nights, not a single afternoon.",
    },
    {
      variant: "outline",
      icon: Languages,
      title: "Pidgin, English and voice notes",
      body: "Guest: “Abeg, una get room for two nights?” Colly answers in the same language with the real rate for those nights, then asks for the check-in and check-out dates once the guest is ready to book.",
      aside: {
        label: "Example stay",
        value: "₦45,000 / night",
        note: "3 nights = ₦135,000",
      },
    },
  ],
};

/**
 * The honest small print, in the order a hotel owner asks the questions.
 * Every line is a limit of the shipped product, so the page never oversells.
 */
const HOTEL_NOTES = [
  {
    title: "Your room list is the catalogue.",
    body: "Import rooms the same way you import products — CSV or Jiji — or add them by hand. Colly quotes only what is in that list.",
  },
  {
    title: "WhatsApp is a waitlist.",
    body: "Telegram, Discord and Web Chat connect yourself in minutes. WhatsApp is onboarded manually because Meta requires a CAC certificate and a review.",
  },
  {
    title: "Deposits are approved by you.",
    body: "A receipt becomes a draft invoice, never a paid one. Your team approves the payment before anything is marked settled.",
  },
  {
    title: "Naira pricing, cancel anytime.",
    body: `Start free with ${FREE_PLAN_LIMITS.credits} AI credits every month, then ${formatNaira(PLANS.green.monthly)} (Green), ${formatNaira(PLANS.blue.monthly)} (Blue) or ${formatNaira(PLANS.black.monthly)} (Black) per month. AI replies cost ${REPLY_CREDIT_COSTS.standard} credits; replies you type yourself are free.`,
  },
];

export default function HotelsPage() {
  return (
    <>
      {/* The product node (with its Naira offers) is the one structured-data
          answer this page needs: same builder as `/pricing`, priced from
          lib/plans.ts. It deliberately renders no `FAQPage` — the homepage's
          `<FAQ />` owns that node, and a second one would reintroduce the
          duplicate-schema bug the SEO tests guard against. */}
      <JsonLd data={softwareApplicationJsonLd()} />

      <Hero
        badge="For hotels, guest houses and short-lets"
        heading={
          <>
            The 24/7 AI Receptionist for{" "}
            <span className="text-[#FF6600]">Nigerian Hotels.</span>
          </>
        }
        subhead="Handle room inquiries, check availability, and take deposits on Telegram and Web Chat while you focus on your guests."
        ctaHref={SIGNUP_HREF}
        ctaLabel="Start Free"
        secondaryHref="#benefits"
        secondaryLabel="See what it handles"
        imageAlt="Hotel owner chatting with a guest through Colly AI"
        footnote="Telegram, Discord and Web Chat · No card required to start"
      />

      {/* BENEFITS — the hotel-specific list, before the shared feature grid. */}
      <section id="benefits" className="bg-white py-20 sm:py-24">
        <ScrollReveal className="mx-auto max-w-7xl px-4">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything a guest asks at the front desk, answered.
            </h2>
            <p className="mt-4 text-gray-600">
              Rates, availability, deposits, check-in and check-out — the
              questions that fill a hotel&apos;s chat all day, handled by one
              assistant that reads your own room list.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HOTEL_BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className="rounded-3xl border border-gray-200 bg-white p-7"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6600]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-gray-900">
                    {benefit.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {benefit.body}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link
              href={SIGNUP_HREF}
              className="inline-flex items-center justify-center rounded-xl bg-[#FF6600] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#E65C00]"
            >
              Set up your AI receptionist
            </Link>
            <p className="mt-3 text-[13px] text-gray-500">
              It takes a minute. Your hotel starts in Hotel mode.
            </p>
          </div>
        </ScrollReveal>
      </section>

      <Features content={HOTEL_FEATURES} />

      <Pricing industry="HOTEL" />

      {/* GOOD TO KNOW — the limits, spelled out. */}
      <section className="bg-[#f5f5f5] py-20 sm:py-24">
        <ScrollReveal className="mx-auto max-w-4xl px-4">
          <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900">
            Good to know
          </h2>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            {HOTEL_NOTES.map((note) => (
              <div key={note.title} className="rounded-2xl bg-white p-6">
                <dt className="font-semibold text-gray-900">{note.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-gray-600">
                  {note.body}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 text-sm text-gray-600">
            Running a shop instead?{" "}
            <Link
              href="/"
              className="font-medium text-colly transition-colors hover:text-colly-hover"
            >
              Colly works for retail too
            </Link>
            .
          </p>
        </ScrollReveal>
      </section>

      <FounderAndCTA signupHref={SIGNUP_HREF} />
    </>
  );
}

