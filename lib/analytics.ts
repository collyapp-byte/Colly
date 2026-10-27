/**
 * Client-side analytics helpers for Umami.
 *
 * The tracker itself is loaded once from the root layout (`app/layout.tsx`),
 * guarded by `NEXT_PUBLIC_UMAMI_WEBSITE_ID`. That means the global `window.umami`
 * object is only present in the browser, only after the script has executed,
 * and not at all when analytics is unconfigured (local clones, previews).
 * Everything here therefore has to be a safe no-op.
 */

/** The subset of the Umami browser API this app uses. */
type UmamiTracker = {
  track: (
    event: string,
    data?: Record<string, string | number | boolean>,
  ) => void;
};

/**
 * Records a custom Umami event. Pageviews are not sent from here: the root
 * layout disables the script's own automatic pageviews
 * (`data-auto-pageview="false"`) and `components/analytics/umami-tracker.tsx`
 * reports one pageview per URL instead.
 *
 * Safe to call from anywhere in a Client Component: it does nothing during
 * server rendering and nothing when the script is missing or still loading, so
 * analytics can never break a user flow.
 */
export function trackEvent(
  event: string,
  data?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;

  const tracker = (window as Window & { umami?: UmamiTracker }).umami;
  tracker?.track(event, data);
}
