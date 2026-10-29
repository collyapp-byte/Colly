import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import {
  COMPETITORS,
  COMPETITORS_HUB_PATH,
  COMPETITOR_DISCLAIMER,
  COMPETITOR_REVIEWED,
  competitorPath,
} from "@/lib/competitors";
import { COUNTRIES, countryPath } from "@/lib/countries";
import {
  LOCATIONS,
  LOCATIONS_HUB_PATH,
  locationPath,
} from "@/lib/locations";
import {
  comparisonHubDescription,
  comparisonHubJsonLd,
  pageMetadata,
} from "@/lib/seo";

/**
 * The comparison hub: `/vs`.
 *
 * Every `/vs/[competitor]` page links to the other comparisons, so the set was
 * crawlable but had no single entry point and no URL a person could be sent to.
 * This hub is that entry point: one card per competitor from
 * `lib/competitors.ts` (name, the neutral one-sentence summary, and who the tool
 * genuinely suits), the dated disclaimer, and links onward to the place pages.
 *
 * `comparisonHubJsonLd()` publishes the same set as a `CollectionPage` whose
 * `mainEntity` is an ItemList of the comparison URLs, so the list an answer
 * engine reads is exactly the list the cards render.
 *
 * The title is `absoluteTitle` on purpose: "Colly AI vs Competitors | Comparison"
 * is the whole title this page needs, and the root template would otherwise
 * append "| Colly Nigeria" to it.
 */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Colly AI vs Competitors | Comparison",
    absoluteTitle: true,
    description: comparisonHubDescription(),
    path: COMPETITORS_HUB_PATH,
    keywords: [
      "Colly AI vs competitors",
      "AI sales assistant comparison Nigeria",
      ...COMPETITORS.map((competitor) => `${competitor.name} alternative`),
      "Naira priced AI chatbot",
    ],
  });
}

export default function ComparisonsHubPage() {
  return (
    <>
      <JsonLd data={comparisonHubJsonLd()} />

      <section className="pt-12 pb-6 sm:pt-16">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6600]">
            Comparisons
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Colly AI vs the alternatives
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            The tools Nigerian shops shortlist most often — from WhatsApp
            specialists to custom-trained agents — compared on the six things
            that decide the sale: the paperwork needed to start, whether you pay
            in Naira or dollars, Jiji catalogue sync, Pidgin and voice notes, the
            channels your customers already use, and how much of the reply is
            really AI. One page per comparison, last reviewed in{" "}
            {COMPETITOR_REVIEWED}.
          </p>
        </div>
      </section>

      <section className="pb-14 sm:pb-16">
        <div className="mx-auto max-w-5xl px-4">
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {COMPETITORS.map((competitor) => (
              <li key={competitor.slug} className="h-full">
                <Link
                  href={competitorPath(competitor.slug)}
                  className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 transition-colors hover:border-[#FF6600]"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Comparison
                  </p>
                  <h2 className="mt-2 font-display text-lg font-bold text-gray-900 group-hover:text-[#FF6600]">
                    Colly AI vs {competitor.name}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {competitor.summary}
                  </p>
                  <p className="mt-4 text-xs font-medium leading-relaxed text-gray-500">
                    <span className="font-semibold text-gray-700">
                      Best for:
                    </span>{" "}
                    {competitor.bestFor}
                  </p>
                  <span className="mt-4 text-sm font-semibold text-[#FF6600] group-hover:underline">
                    Read the comparison →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-xs leading-relaxed text-gray-500">
            {COMPETITOR_DISCLAIMER}
          </p>
        </div>
      </section>

      <section className="bg-white/60 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Colly AI by location
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
            The same assistant and the same Naira price list everywhere it is
            sold — the city and country pages carry the local detail.
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-3">
            <li>
              <Link
                href={LOCATIONS_HUB_PATH}
                className="text-sm font-semibold text-[#FF6600] hover:underline"
              >
                All locations
              </Link>
            </li>
            {COUNTRIES.map((country) => (
              <li key={country.slug}>
                <Link
                  href={countryPath(country.slug)}
                  className="text-sm font-semibold text-[#FF6600] hover:underline"
                >
                  Colly AI in {country.name}
                </Link>
              </li>
            ))}
            {LOCATIONS.map((location) => (
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

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup?role=business"
              className="rounded-lg bg-[#FF6600] px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
            >
              Start free
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
