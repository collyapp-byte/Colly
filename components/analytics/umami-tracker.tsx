"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Reports a pageview to Umami on every App Router navigation.
 *
 * Why this exists: App Router navigations never reload the document, so a
 * pageview can only be recorded by something watching the URL. This component
 * does that explicitly — one pageview per pathname + query-string combination,
 * including the landing page — and it is mounted once, from the root layout, so
 * marketing, auth and dashboard routes are all covered.
 *
 * Ownership of pageviews: `app/layout.tsx` renders the Umami `<Script>` with
 * `data-auto-pageview="false"` and this component sends them instead. The
 * script's own history hook would otherwise report every navigation a second
 * time (it patches `history.pushState`/`replaceState`), double-counting the
 * dashboard and marketing routes. One URL in, exactly one pageview out.
 *
 * Optional by design: the layout only mounts this when
 * `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is configured, so local clones and previews
 * send nothing.
 */

/** Pageview properties Umami hands to the payload callback. */
type UmamiPayload = Record<string, unknown>;

/** The subset of the Umami browser API this component uses. */
type UmamiBrowserApi = {
  track: (payload: (props: UmamiPayload) => UmamiPayload) => void;
};

/**
 * `next/script` loads the tracker with `afterInteractive`, so on the very first
 * render the global can still be missing. Poll briefly rather than dropping the
 * landing pageview — ten seconds is far longer than the script takes to arrive,
 * and ad-blocked visitors simply stop after that.
 */
const RETRY_INTERVAL_MS = 250;
const MAX_RETRIES = 40;

export function UmamiTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The URL of the last pageview we actually sent. Tracking the *sent* URL (not
  // the attempted one) keeps React's development double-invocation and Next's
  // same-route `replaceState` calls from producing duplicates, while still
  // retrying when the tracker script had not loaded yet.
  const lastSentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (lastSentUrlRef.current === url) return;

    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const send = () => {
      const api = (window as Window & { umami?: UmamiBrowserApi }).umami;
      if (!api) {
        if (retries >= MAX_RETRIES) return;
        retries += 1;
        timer = setTimeout(send, RETRY_INTERVAL_MS);
        return;
      }

      // Callback form on purpose: keep Umami's own properties (website, title,
      // language, referrer, screen) and override only the URL, so the path and
      // its query string are attributed to the page the visitor is on.
      api.track((props) => ({ ...props, url }));
      lastSentUrlRef.current = url;
    };

    send();

    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [pathname, searchParams]);

  return null;
}
