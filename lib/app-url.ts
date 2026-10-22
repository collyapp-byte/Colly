// The public base URL of the deployed app, used for Paystack callback
// redirects. It comes strictly from NEXT_PUBLIC_APP_URL: there is no localhost
// fallback, so a missing value fails loudly instead of sending users (or
// Paystack) to a machine that isn't reachable.

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required. " +
        "Set it to your deployed URL (e.g. https://colly.com.ng).",
    );
  }
  return url.replace(/\/$/, ""); // strip trailing slash
}
