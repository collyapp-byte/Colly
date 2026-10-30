/**
 * Server-side logging helpers.
 *
 * `console.info`/`console.warn`/`console.error` are kept for events an operator
 * should see in production logs: a delivered owner alert, a provider switch, a
 * billing webhook, a completed payout. Anything that is only useful while
 * debugging — a translated Pidgin query, a raw provider payload, an incoming
 * Discord body, an escalation trace — goes through `debugLog`, which is a no-op
 * in a production build. That keeps customer messages and payment payloads out
 * of the hosting provider's log retention, which is the cheapest possible PII
 * control.
 */
const isProduction = process.env.NODE_ENV === "production";

/** Development-only diagnostic trace. Does nothing in a production build. */
export function debugLog(...args: unknown[]): void {
  if (!isProduction) {
    console.info(...args);
  }
}
