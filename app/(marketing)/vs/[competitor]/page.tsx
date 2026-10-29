import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import {
  COMPARISON_FEATURES,
  COMPETITORS,
  COMPETITOR_DISCLAIMER,
  COMPETITOR_REVIEWED,
  comparisonAnswer,
  competitorPath,
  getCompetitor,
  type Competitor,
} from "@/lib/competitors";
import { comparisonJsonLd, pageMetadata } from "@/lib/seo";

/**
 * Programmatic competitor comparison pages (GEO/AEO).
 *
 * One URL per entry in `lib/competitors.ts`, prerendered from
 * `generateStaticParams`. The page answers "Colly AI vs <competitor>" in the
 * first paragraph, then puts the same five axes in one large table, then
 * publishes `comparisonJsonLd()` — a WebPage wrapping an ItemList of two
 * SoftwareApplications, each with one `PropertyValue` per row. That node is what
 * an AI Overview reads when it has to summarise the comparison, and it is built
 * from the same arrays the table renders, so the schema cannot disagree with the
 * copy.
 *
 * Comparison rows only carry claims we can stand behind (see the header of
 * `lib/competitors.ts`), and `COMPETITOR_DISCLAIMER` is rendered under the
 * table with a review date.
 *
 * `dynamicParams` is deliberately NOT exported: this app runs with
 * `cacheComponents: true`, where that route segment config is unavailable, so an
 * unknown slug is rendered on demand. Because partial prerendering streams the
 * shell first, a `notFound()` thrown here keeps the `200` (a soft 404) — the
 * proxy's `isUnknownGeoRoute()` check answers the real 404 instead.
 */
type VsPageProps = { params: Promise<{ competitor: string }> };

/** Every comparison is known at build time. */
export function generateStaticParams(): { competitor: string }[] {
  return COMPETITORS.map((competitor) => ({ competitor: competitor.slug }));
}

export async function generateMetadata({
  params,
}: VsPageProps): Promise<Metadata> {
  const competitor = getCompetitor((await params).competitor);
  if (!competitor) return {};

  return pageMetadata({
    title: `Colly AI vs ${competitor.name}`,
    description: comparisonAnswer(competitor),
    path: competitorPath(competitor.slug),
    keywords: [
      `Colly AI vs ${competitor.name}`,
      `${competitor.name} alternative`,
      `${competitor.name} alternative Nigeria`,
      "AI sales assistant Nigeria",
      "Naira priced AI chatbot",
    ],
  });
}

/**
 * The unknown-slug case is settled in the proxy (`isUnknownGeoRoute` rewrites it
 * to a 404 before the partially prerendered shell streams); the `notFound()`
 * here is the second line of defence. Every comparison comes from
 * `generateStaticParams` and nothing changes per request, so the page needs no
 * `<Suspense>` boundary.
 */
export default async function VersusPage({ params }: VsPageProps) {
  const competitor = getCompetitor((await params).competitor);
  if (!competitor) notFound();

  return <Versus competitor={competitor} />;
}

function Versus({ competitor }: { competitor: Competitor }) {
  const others = COMPETITORS.filter((other) => other.slug !== competitor.slug);

  return (
    <>
      <JsonLd data={comparisonJsonLd(competitor)} />

      <section className="pt-12 pb-4 sm:pt-16">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6600]">
            Comparison
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Colly AI vs {competitor.name}
          </h1>
          {/* The direct answer, first paragraph: an answer engine can lift this
              sentence pair without reading the table. */}
          <p className="mt-4 text-lg leading-relaxed text-gray-700">
            {comparisonAnswer(competitor)}
          </p>
          <p className="mt-3 text-sm text-gray-500">
            Last reviewed {COMPETITOR_REVIEWED}. Colly AI prices come from{" "}
            <Link
              href="/pricing"
              className="font-semibold text-[#FF6600] hover:underline"
            >
              our pricing page
            </Link>
            ; competitor details come from their public websites.
          </p>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[44rem] border-collapse text-left">
              <caption className="sr-only">
                Feature comparison of Colly AI and {competitor.name}
              </caption>
              <thead>
                <tr className="bg-gray-50">
                  <th
                    scope="col"
                    className="w-1/4 px-4 py-5 text-sm font-semibold text-gray-500"
                  >
                    Feature
                  </th>
                  <th
                    scope="col"
                    className="border-x border-[#FF6600]/20 bg-[#FF6600]/5 px-4 py-5"
                  >
                    <span className="block text-base font-bold text-gray-900">
                      Colly AI
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-[#FF6600]">
                      Built for Nigerian SMEs
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-5 text-base font-bold text-gray-900">
                    {competitor.name}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {COMPARISON_FEATURES.map((feature) => (
                  <tr key={feature.id} className="align-top">
                    <th
                      scope="row"
                      className="px-4 py-5 text-sm font-semibold text-gray-900"
                    >
                      {feature.label}
                    </th>
                    <td className="border-x border-[#FF6600]/20 bg-[#FF6600]/5 px-4 py-5 text-sm leading-relaxed text-gray-800">
                      {feature.colly}
                    </td>
                    <td className="px-4 py-5 text-sm leading-relaxed text-gray-600">
                      {competitor.values[feature.id]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            {COMPETITOR_DISCLAIMER}
          </p>
        </div>
      </section>

      <section className="bg-white pb-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Where {competitor.name} fits
          </h2>
          <p className="mt-3 text-base leading-relaxed text-gray-600">
            {competitor.summary}
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
            <li>
              <strong className="font-semibold text-gray-900">Best for.</strong>{" "}
              {competitor.bestFor}
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                Pricing model.
              </strong>{" "}
              {competitor.pricingModel}
            </li>
          </ul>

          <h2 className="mt-12 font-display text-2xl font-bold text-gray-900">
            Why Nigerian businesses pick Colly AI instead
          </h2>
          <p className="mt-3 text-base leading-relaxed text-gray-600">
            {competitor.collyEdge}
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600">
            <li>
              <strong className="font-semibold text-gray-900">
                Start today, no paperwork.
              </strong>{" "}
              Telegram, Discord and Web Chat go live in minutes with no CAC
              certificate and no Meta review. WhatsApp — the one channel that
              does need Meta verification — is onboarded from a manual waitlist.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                One Naira price list.
              </strong>{" "}
              Plans, top-ups and AI replies are all priced in Naira through
              Paystack, so a Lagos shop never has to explain a dollar charge to
              its accountant.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">
                Catalogue, not memory.
              </strong>{" "}
              Every product question hits your catalogue, and a Jiji shop can be
              imported and re-synced instead of retyped.
            </li>
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

      <section className="pb-20 sm:pb-24">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Other comparisons
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={competitorPath(other.slug)}
                  className="text-sm font-semibold text-[#FF6600] hover:underline"
                >
                  Colly AI vs {other.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/locations/lagos"
                className="text-sm font-semibold text-[#FF6600] hover:underline"
              >
                AI sales assistant for Lagos businesses
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
