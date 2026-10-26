import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, absoluteUrl } from "@/lib/site";

/**
 * `GET /sitemap.xml` — the public pages, in priority order.
 *
 * Generated from `lib/site.ts#PUBLIC_PAGES` rather than hand-written XML so a
 * new marketing page is one list entry and can never drift from `robots.txt`.
 * Only routes that render without a session belong here: a sitemap full of
 * redirects or 404s costs crawl trust.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
