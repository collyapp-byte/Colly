/**
 * Shared input validators.
 *
 * Kept dependency-free so both server actions and API routes can use them.
 */

/**
 * Lightweight email sanity check: a non-empty local part, a single "@", and a
 * dot-separated domain with no whitespace. Not RFC-complete — Supabase Auth is
 * the real authority for email validity — but it rejects the obviously wrong
 * input (missing "@", spaces, no domain) before an auth round trip.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
