import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { COMPETITORS_HUB_PATH } from "@/lib/competitors";
import { COUNTRIES, countryPath } from "@/lib/countries";
import {
  LOCATIONS,
  LOCATIONS_HUB_PATH,
  locationPath,
} from "@/lib/locations";
import {
  pageMetadata,
  placesHubDescription,
  placesHubJsonLd,
} from "@/lib/seo";

/**
 * The place hub: `/locations`.
 *
 * The city pages (`/locations/[city]`) and the country pages
 * (`/countries/[country]`) each link sideways to their siblings, but a crawler
 * (or a person) had no page that lists all of them. This hub is that index: one
 * "By Country" section from `lib/countries.ts`, then one "By City" section from
 * `lib/locations.ts`, every entry a link to its landing page.
 *
 * `placesHubJsonLd()` publishes the same set as a `CollectionPage` whose
 * `mainEntity` is an ItemList of `Country` and `City` items, so the coverage an
 * answer engine reads matches the coverage the page shows.
 *
 * Nothing here is per-place copy that could drift: names, states, districts and
 * the country note all come from the data modules, and the price quoted in the
 * description comes from `lib/plans.ts`.
 */
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "AI Sales Assistant by City and Country",
    description: placesHubDescription(),
    path: LOCATIONS_HUB_PATH,
    keywords: [
      "AI sales assistant by city",
      "AI sales assistant Nigeria",
      "AI customer service Lagos",
      "AI sales assistant Africa",
      "Colly AI locations",
    ],
  });
}

export default function LocationsHubPage() {
  return (
    <>
      <JsonLd data={placesHubJsonLd()} />

      <section className="pt-12 pb-6 sm:pt-16">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6600]">
            Locations
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Colly AI where your business is
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            Colly AI sells to businesses in {LOCATIONS.length} Nigerian cities
            and in {COUNTRIES.length} countries around Africa. Pick a page for
            the local detail — the markets a city trades in, how shops there
            actually sell, and which currency the bank settles in. The price
            list itself is one Naira list everywhere.
          </p>
        </div>
      </section>

      <section className="pb-14 sm:pb-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            By Country
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
            One page per country: what the assistant answers, the channels shops
            there use, and the currency your bank settles the Naira charge in.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {COUNTRIES.map((country) => (
              <li key={country.slug} className="h-full">
                <Link
                  href={countryPath(country.slug)}
                  className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 transition-colors hover:border-[#FF6600]"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Prices in Naira · settled in {country.currency}
                  </p>
                  <h3 className="mt-2 font-display text-lg font-bold text-gray-900 group-hover:text-[#FF6600]">
                    Colly AI in {country.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {country.intro}
                  </p>
                  <span className="mt-4 text-sm font-semibold text-[#FF6600] group-hover:underline">
                    AI sales assistant in {country.name} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white/60 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            By City
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
            One page per city, with the markets and districts its shops actually
            trade in — Computer Village, Alaba, Wuse, Kurmi and the rest.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOCATIONS.map((location) => (
              <li key={location.slug} className="h-full">
                <Link
                  href={locationPath(location.slug)}
                  className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 transition-colors hover:border-[#FF6600]"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {location.state}
                  </p>
                  <h3 className="mt-2 font-display text-lg font-bold text-gray-900 group-hover:text-[#FF6600]">
                    AI sales assistant in {location.city}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {location.intro}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-gray-500">
                    {location.areas.join(" · ")}
                  </p>
                  <span className="mt-4 text-sm font-semibold text-[#FF6600] group-hover:underline">
                    Read the {location.city} page →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
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
            <Link
              href={COMPETITORS_HUB_PATH}
              className="text-sm font-semibold text-[#FF6600] hover:underline sm:ml-2"
            >
              Compare Colly AI with the alternatives →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
