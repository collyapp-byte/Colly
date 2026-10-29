import { updateSession } from "@/lib/supabase/proxy";
import type { NextRequest } from "next/server";

/**
 * Next.js Proxy (the file convention that replaced `middleware` in Next 16).
 * It must sit at the project root, alongside `app`, so it runs before every
 * matched request: it keeps the Supabase session fresh and bounces signed-out
 * visitors away from the dashboard before any page renders.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals, static assets and the metadata
     * files: those are served straight from disk (or generated with no session
     * involvement), and running auth logic on them would break CSS, images and
     * crawler access for signed-out visitors. `robots.txt`, `sitemap.xml` and
     * `llms.txt` must stay reachable for crawlers (and for the AI engines that
     * read `llms.txt`), which have no cookies to refresh — without the exclusion
     * the auth redirect answers `/llms.txt` with a 307 to /login instead of the
     * file.
     */
    "/((?!api/health|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
