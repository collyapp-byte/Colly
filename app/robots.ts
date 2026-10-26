import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, SITE_URL } from "@/lib/site";

/**
 * `GET /robots.txt` — crawl everything public, nothing private.
 *
 * `app/api/*` is a Route Handler surface with no HTML to index, the dashboard
 * and the agent area sit behind auth (they redirect to `/login`, so indexing
 * them would only burn crawl budget), and `/chat/[businessId]` renders a single
 * business's customer widget. The public pages themselves are listed in
 * `app/sitemap.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PATHS],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
