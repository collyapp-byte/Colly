// The public base URL of the deployed app, used for Paystack callback
// redirects. There is no safe localhost fallback in production, so a missing
// value throws there instead of silently sending users to localhost.

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) return url.replace(/\/$/, ""); // strip trailing slash

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required in production. " +
        "Set it to your deployed URL (e.g. https://colly.com.ng).",
    );
  }
  return "http://localhost:3000";
}
