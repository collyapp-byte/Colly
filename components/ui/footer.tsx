import Link from "next/link";

import {
  COMPETITORS,
  COMPETITORS_HUB_PATH,
  competitorPath,
} from "@/lib/competitors";
import { COUNTRIES, countryPath } from "@/lib/countries";
import { LOCATIONS, LOCATIONS_HUB_PATH, locationPath } from "@/lib/locations";

/**
 * Global site footer. Rendered at the bottom of the public, auth, agent and
 * dashboard shells, which makes it the one set of internal links every page on
 * the site carries — so it is also where the programmatic pages get their
 * sitewide entry point.
 *
 * Two of the four columns exist for crawlability:
 *
 * - **Compare** lists the `/vs` hub and every competitor from
 *   `lib/competitors.ts`, so the comparison pages are one click from anywhere
 *   instead of only reachable from each other.
 * - **Locations** lists the `/locations` hub, two country pages and two city
 *   pages. It is deliberately a curated slice: the hub links every place page,
 *   and a footer that duplicated them would bury the real navigation.
 *
 * Labels and hrefs come from the data modules, so a new competitor or a renamed
 * city appears here without touching this file.
 */
type FooterLink = { href: string; label: string };

const PRODUCT_LINKS: readonly FooterLink[] = [
  { href: "/pricing", label: "Pricing" },
  { href: "/hotels", label: "For hotels" },
  { href: "/academy", label: "Agent Academy" },
  { href: "/find-an-agent", label: "Find an Agent" },
];

const COMPARE_LINKS: readonly FooterLink[] = [
  { href: COMPETITORS_HUB_PATH, label: "All comparisons" },
  ...COMPETITORS.map((competitor) => ({
    href: competitorPath(competitor.slug),
    label: competitor.name,
  })),
];

/** The two countries and two cities the footer promotes; order follows data. */
const FEATURED_COUNTRY_SLUGS: readonly string[] = ["nigeria", "ghana"];
const FEATURED_CITY_SLUGS: readonly string[] = ["lagos", "abuja"];

const LOCATION_LINKS: readonly FooterLink[] = [
  { href: LOCATIONS_HUB_PATH, label: "All locations" },
  ...COUNTRIES.filter((country) =>
    FEATURED_COUNTRY_SLUGS.includes(country.slug),
  ).map((country) => ({
    href: countryPath(country.slug),
    label: country.name,
  })),
  ...LOCATIONS.filter((location) =>
    FEATURED_CITY_SLUGS.includes(location.slug),
  ).map((location) => ({
    href: locationPath(location.slug),
    label: location.city,
  })),
];

const LEGAL_LINKS: readonly FooterLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/account/delete", label: "Delete Account" },
];


function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly FooterLink[];
}) {
  return (
    <nav aria-label={title}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-900">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="transition-colors hover:text-gray-700"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer
      data-print-hide
      className="border-t border-gray-100 px-4 py-10 text-xs text-gray-500"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-sm font-bold text-gray-900">
              Colly AI
            </p>
            {/* Entity declaration beside the brand: every page carrying the
                footer states what Colly is, and which namesakes it is not. */}
            <p className="mt-3 leading-relaxed">
              Colly AI is a Nigerian software company building AI sales
              assistants for SMEs. We are not affiliated with any other
              businesses or individuals using the name Colly.
            </p>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Compare" links={COMPARE_LINKS} />
          <FooterColumn title="Locations" links={LOCATION_LINKS} />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-gray-100 pt-6">
          {LEGAL_LINKS.map((link, index) => (
            <span key={link.href} className="flex items-center gap-x-3">
              {index > 0 && <span aria-hidden="true">·</span>}
              <Link
                href={link.href}
                className="transition-colors hover:text-gray-700"
              >
                {link.label}
              </Link>
            </span>
          ))}
          <span aria-hidden="true">·</span>
          <p>© 2026 Colly. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
