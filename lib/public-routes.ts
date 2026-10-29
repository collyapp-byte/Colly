/**
 * Which paths render for a visitor with no Supabase session.
 *
 * Live in a dependency-free module because two very different places need the
 * same answer: `lib/supabase/proxy.ts` runs it on every request (so it must not
 * pull Prisma or Supabase into an import graph a test can reach), and
 * `tests/seo.test.ts` imports it to prove that every URL advertised in
 * `sitemap.xml` is actually reachable by Googlebot.
 *
 * The marketing and legal pages are derived from `lib/site.ts#PUBLIC_PAGES` --
 * the single list behind the sitemap and the per-page canonicals -- so a page a
 * crawler is told to index can never hide behind the login redirect.
 */

import { PUBLIC_PAGES } from "@/lib/site";
import { getCompetitor } from "@/lib/competitors";
import { getCountry } from "@/lib/countries";
import { getLocation } from "@/lib/locations";

/**
 * Session-free routes that are deliberately *not* in the sitemap: the Supabase
 * auth callback, the embeddable web-chat widget (opened on customer sites, often
 * inside an iframe), agent certificate verification, the email-confirmation
 * landing page, the password recovery screens and the agent discovery
 * directory.
 *
 * `/locations`, `/countries` and `/vs` are the programmatic GEO prefixes. Their
 * *known* cities, countries and competitors are in the sitemap through
 * `PUBLIC_PAGES`; the prefixes are listed here so an unlisted slug is answered by
 * the app rather than by the login redirect (see `isUnknownGeoRoute`, which turns
 * an unlisted slug into a real 404 before the page renders — a redirect reads as
 * a soft 404 to a crawler).
 */
const SESSION_FREE_PATHS: readonly string[] = [
  "/auth/callback",
  "/chat",
  "/verify",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/find-an-agent",
  "/locations",
  "/countries",
  "/vs",
];

export const PUBLIC_ROUTE_PATHS: readonly string[] = [
  ...PUBLIC_PAGES.map((page) => page.path),
  ...SESSION_FREE_PATHS,
];

/**
 * True when `pathname` or one of its parents is a public route.
 *
 * A path also matches beneath itself (`/chat/business-1` under `/chat`). "/" is
 * special-cased to the homepage only: appending "/" would produce "//", which
 * never matches, so a prefix check would silently let every path through.
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PATHS.some((path) =>
    path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * True when `pathname` is a programmatic GEO URL whose slug has no record:
 * `/locations/<unknown city>`, `/countries/<unknown country>` or
 * `/vs/<unknown competitor>`.
 *
 * The pages themselves call `notFound()`, but partial prerendering streams the
 * static shell before the page renders, so a `notFound()` thrown that late can
 * only keep the `200` already sent and add `noindex` — a soft 404, which search
 * engines report and some drop silently. The proxy checks the slug *before* the
 * response starts and rewrites to a path with no route, so the answer is a real
 * 404 with the app's not-found page. The lookup is an array scan over static
 * data, so it costs nothing per request.
 */
export function isUnknownGeoRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return false;

  const [prefix, slug] = segments;
  if (prefix === "locations") return getLocation(slug) === undefined;
  if (prefix === "countries") return getCountry(slug) === undefined;
  if (prefix === "vs") return getCompetitor(slug) === undefined;
  return false;
}

/**
 * A path with no route: rewriting a request here inside the proxy answers with
 * the app's `not-found` page and a `404` status, while the visitor's address bar
 * keeps the URL they typed.
 */
export const NOT_FOUND_REWRITE_PATH = "/not-found";
