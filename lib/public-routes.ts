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

/**
 * Session-free routes that are deliberately *not* in the sitemap: the Supabase
 * auth callback, the embeddable web-chat widget (opened on customer sites, often
 * inside an iframe), agent certificate verification, the email-confirmation
 * landing page, the password recovery screens and the agent discovery
 * directory.
 */
const SESSION_FREE_PATHS: readonly string[] = [
  "/auth/callback",
  "/chat",
  "/verify",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/find-an-agent",
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
