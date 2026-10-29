import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hero } from "@/components/marketing/hero";
import { Pricing } from "@/components/marketing/pricing";
import { JsonLd } from "@/components/seo/json-ld";
import { COMPETITORS, competitorPath } from "@/lib/competitors";
import { formatNaira } from "@/lib/format";
import {
  LOCATIONS,
  getLocation,
  locationPath,
  type Location,
} from "@/lib/locations";
import { PLANS, REPLY_CREDIT_COSTS } from "@/lib/plans";
import { locationDescription, locationJsonLd, pageMetadata } from "@/lib/seo";

/**
 * Programmatic city landing pages (GEO).
 *
 * One URL per city in `lib/locations.ts`, prerendered from `generateStaticParams`
 * so a crawler gets a complete document in the first HTML paint. Each page owns
 * its title, description and canonical (`pageMetadata`), and publishes a
 * WebPage + Service node whose `areaServed` names the city
 * (`lib/seo.ts#locationJsonLd`) — that is the fact an answer engine needs before
 * it will say "Colly AI is available in <city>".
 *
 * The page is a localized variation of the homepage, not a doorway page: it
 * renders the same `Hero` and `Pricing` components with the city passed down
 * (so prices still come from `lib/plans.ts`), and adds locally specific copy
 * from the location record — named markets, and what a shop there actually sells.
 *
 * `dynamicParams` is deliberately NOT exported: this app runs with
 * `cacheComponents: true`, where that route segment config is unavailable, so
 * an unknown slug is rendered on demand — and hits `notFound()` before anything
 * streams, which is a real 404 rather than a soft 404.
 */
type CityPageProps = { params: Promise<{ city: string }> };

/** Every city is known at build time, so none is rendered on first request. */
export function generateStaticParams(): { city: string }[] {
  return LOCATIONS.map((location) => ({ city: location.slug }));
}

export async function generateMetadata({
  params,
}: CityPageProps): Promise<Metadata> {
  const location = getLocation((await params).city);
  if (!location) return {};

  // The root layout template appends "| Colly Nigeria", so the rendered title is
  // "AI Sales Assistant in Lagos | Colly Nigeria".
  return pageMetadata({
    title: `AI Sales Assistant in ${location.city}`,
    description: locationDescription(location),
    path: locationPath(location.slug),
    keywords: [
      `AI sales assistant ${location.city}`,
      `chatbot for small business ${location.city}`,
      `Telegram bot for business ${location.city}`,
      `customer service software ${location.city}`,
      `AI customer service Nigeria`,
    ],
  });
}

/**
 * The direct answer at the top of the page: what Colly is, where it works and
 * what it costs, with the city named. Same answer-first shape as the homepage
 * BLUF, so an engine can quote either page — and the price comes from
 * `lib/plans.ts`, never typed here.
 */
function cityAnswer(location: Location): string {
  return `Colly AI gives ${location.city} businesses a 24/7 AI sales assistant on Telegram, Discord and Web Chat. It answers price, stock and delivery questions from your own catalogue in English or Nigerian Pidgin, never negotiates below your floor price, and costs ${formatNaira(
    PLANS.green.monthly,
  )} a month after a free tier.`;
}

/**
 * The unknown-slug case is settled in the proxy (`isUnknownGeoRoute` rewrites it
 * to a 404 before the partially prerendered shell streams); the `notFound()`
 * here is the second line of defence, so a slug with no record can never render
 * page content. Nothing below changes per request — every city comes from
 * `generateStaticParams` — so there is no dynamic work to put behind a
 * `<Suspense>` boundary.
 */
export default async function CityLandingPage({ params }: CityPageProps) {
  const location = getLocation((await params).city);
  if (!location) notFound();

  return <CityLanding location={location} />;
}

function CityLanding({ location }: { location: Location }) {
  return (
    <>
      <JsonLd data={locationJsonLd(location)} />

      <Hero place={location.city} />

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Does Colly AI work for businesses in {location.city}?
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-gray-700">
            {cityAnswer(location)}
          </p>

          <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">
            Where {location.city} businesses use it
          </h2>
          <p className="mt-3 text-base leading-relaxed text-gray-600">
            {location.intro}
          </p>
          <ul
            className="mt-4 flex flex-wrap gap-2"
            aria-label={`${location.city} trading areas`}
          >
            {location.areas.map((area) => (
              <li
                key={area}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600"
              >
                {area}
              </li>
            ))}
          </ul>

          <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">
            What the assistant handles
          </h2>
          <ul className="mt-4 space-y-3 text-base leading-relaxed text-gray-600">
            <li>
              <strong className="font-semibold text-gray-900">
                Prices and stock, 24/7.
              </strong>{" "}
              Every product question triggers a catalogue search, so the reply
              quotes what you actually sell rather than what the model remembers.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                English and Nigerian Pidgin.
              </strong>{" "}
              The tone is set per business, and voice notes are transcribed
              before they are answered.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                Your floor price, not a guess.
              </strong>{" "}
              Colly negotiates up to the limit you set and never goes below it,
              then alerts you when a request needs a human.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                Naira credits.
              </strong>{" "}
              One credit is ₦1 and an AI reply costs{" "}
              {REPLY_CREDIT_COSTS.standard} credits; replies you type yourself
              are free, so a {location.city} shop can start on the free tier and
              upgrade once the assistant is paying for itself.
            </li>
          </ul>

          <p className="mt-8 text-sm leading-relaxed text-gray-500">
            Setup takes minutes: connect a Telegram bot or drop the Web Chat
            widget on your site. No SIM card and no CAC certificate are needed on
            Telegram, Discord or Web Chat; WhatsApp is onboarded from a manual
            waitlist because Meta requires business verification.
          </p>
        </div>
      </section>

      <Pricing place={location.city} />

      <section className="bg-white/60 pb-20 sm:pb-24">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Compare Colly AI
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {COMPETITORS.map((competitor) => (
              <li key={competitor.slug}>
                <Link
                  href={competitorPath(competitor.slug)}
                  className="text-sm font-semibold text-[#FF6600] hover:underline"
                >
                  Colly AI vs {competitor.name}
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">
            Colly AI in other cities
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {LOCATIONS.filter((other) => other.slug !== location.slug).map(
              (other) => (
                <li key={other.slug}>
                  <Link
                    href={locationPath(other.slug)}
                    className="text-sm font-semibold text-[#FF6600] hover:underline"
                  >
                    AI sales assistant in {other.city}
                  </Link>
                </li>
              ),
            )}
          </ul>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?role=business"
              className="rounded-lg bg-[#FF6600] px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
            >
              Start free in {location.city}
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-900 transition-colors hover:border-gray-400"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
