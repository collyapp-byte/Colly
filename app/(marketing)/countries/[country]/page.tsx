import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hero } from "@/components/marketing/hero";
import { Pricing } from "@/components/marketing/pricing";
import { JsonLd } from "@/components/seo/json-ld";
import { COMPETITORS, competitorPath } from "@/lib/competitors";
import {
  COUNTRIES,
  countryPath,
  getCountry,
  type Country,
} from "@/lib/countries";
import { formatNaira } from "@/lib/format";
import { LOCATIONS, locationPath } from "@/lib/locations";
import { PLANS, REPLY_CREDIT_COSTS } from "@/lib/plans";
import { countryDescription, countryJsonLd, pageMetadata } from "@/lib/seo";

/**
 * Programmatic country landing pages (GEO), one level above the city pages.
 *
 * One URL per country in `lib/countries.ts`, prerendered from
 * `generateStaticParams` so a crawler gets a complete document in the first HTML
 * paint. Each page owns its title, description and canonical (`pageMetadata`)
 * and publishes two JSON-LD nodes (`lib/seo.ts#countryJsonLd`): the `Country`
 * itself and the WebPage/Service node whose `areaServed` cites it — that is the
 * fact an answer engine needs before it will say "Colly AI is available in
 * Kenya".
 *
 * The page is a localized variation of the homepage, not a doorway page: it
 * renders the same `Hero` and `Pricing` components (so prices still come from
 * `lib/plans.ts`) plus the country's own context. It never claims a local price
 * list — Colly bills one Naira price list through Paystack, and the page says so
 * in the buyer's own currency instead.
 *
 * `dynamicParams` is deliberately NOT exported: this app runs with
 * `cacheComponents: true`, where that route segment config is unavailable, so an
 * unknown slug is rendered on demand — and the proxy answers it with a real 404
 * *before* the shell streams (`isUnknownGeoRoute`), with `notFound()` here as the
 * second line of defence.
 */
type CountryPageProps = { params: Promise<{ country: string }> };

/** Every country is known at build time, so none is rendered on first request. */
export function generateStaticParams(): { country: string }[] {
  return COUNTRIES.map((country) => ({ country: country.slug }));
}

export async function generateMetadata({
  params,
}: CountryPageProps): Promise<Metadata> {
  const country = getCountry((await params).country);
  if (!country) return {};

  // The root layout template appends "| Colly Nigeria", so the rendered title is
  // "AI Sales Assistant in Nigeria | Colly Nigeria".
  return pageMetadata({
    title: `AI Sales Assistant in ${country.name}`,
    description: countryDescription(country),
    path: countryPath(country.slug),
    keywords: [
      `AI sales assistant ${country.name}`,
      `AI customer service software ${country.name}`,
      `chatbot for small business ${country.name}`,
      `Telegram bot for business ${country.name}`,
      "AI sales assistant Africa",
    ],
  });
}

/**
 * The direct answer at the top of the page: what Colly is, where it works and
 * what it costs, with the country named. Same answer-first shape as the homepage
 * BLUF and the city pages, so an engine can quote any of them — and the price
 * comes from `lib/plans.ts`, never typed here.
 */
function countryAnswer(country: Country): string {
  return `Colly AI gives businesses in ${country.name} a 24/7 AI sales assistant on Telegram, Discord and Web Chat. It answers price, stock and delivery questions from your own catalogue in English or Nigerian Pidgin, never negotiates below your floor price, and costs ${formatNaira(
    PLANS.green.monthly,
  )} a month after a free tier.`;
}

/**
 * How billing actually works outside Nigeria, stated instead of implied: one
 * Naira price list, charged monthly through Paystack, settled in the buyer's own
 * currency by their bank. No country price list is invented here.
 */
function billingNote(country: Country): string {
  return country.currency === "NGN"
    ? "Plans are priced in Naira and charged once a month through Paystack, from a Nigerian card or bank transfer, with no setup fee."
    : `Plans are priced in Naira and charged once a month through Paystack; a card issued in ${country.name} is settled in ${country.currency} at your bank's rate, and there is no separate ${country.currency} price list.`;
}

export default async function CountryLandingPage({ params }: CountryPageProps) {
  const country = getCountry((await params).country);
  if (!country) notFound();

  return <CountryLanding country={country} />;
}

function CountryLanding({ country }: { country: Country }) {
  // Only cities that actually have a record; the country page links them as the
  // local proof, and the city pages link back here.
  const cities = LOCATIONS.filter((location) =>
    country.cities.includes(location.slug),
  );

  return (
    <>
      <JsonLd data={countryJsonLd(country)} />

      <Hero place={country.name} across />

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Does Colly AI work for businesses in {country.name}?
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-gray-700">
            {countryAnswer(country)}
          </p>
          <p className="mt-3 text-base leading-relaxed text-gray-600">
            {billingNote(country)}
          </p>

          <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">
            How shops in {country.name} use it
          </h2>
          <p className="mt-3 text-base leading-relaxed text-gray-600">
            {country.intro}
          </p>

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
              then alerts you on Telegram when a request needs a human.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                Naira credits.
              </strong>{" "}
              One credit is ₦1 and an AI reply costs{" "}
              {REPLY_CREDIT_COSTS.standard} credits; replies you type yourself
              are free, so a shop in {country.name} can start on the free tier and
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
      <Pricing place={country.name} />

      <section className="bg-white/60 pb-20 sm:pb-24">
        <div className="mx-auto max-w-3xl px-4">
          {cities.length > 0 && (
            <>
              <h2 className="font-display text-2xl font-bold text-gray-900">
                Colly AI in {country.name} cities
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {cities.map((location) => (
                  <li key={location.slug}>
                    <Link
                      href={locationPath(location.slug)}
                      className="text-sm font-semibold text-[#FF6600] hover:underline"
                    >
                      AI sales assistant in {location.city}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">
            Colly AI in other countries
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {COUNTRIES.filter((other) => other.slug !== country.slug).map(
              (other) => (
                <li key={other.slug}>
                  <Link
                    href={countryPath(other.slug)}
                    className="text-sm font-semibold text-[#FF6600] hover:underline"
                  >
                    AI sales assistant in {other.name}
                  </Link>
                </li>
              ),
            )}
          </ul>

          <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">
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

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?role=business"
              className="rounded-lg bg-[#FF6600] px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
            >
              Start free in {country.name}
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
