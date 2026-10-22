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

/** Minimum length a password must have. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * The wording shown when a password is too weak. Shared by the forms and the
 * server actions so both say exactly the same thing.
 */
export const WEAK_PASSWORD_MESSAGE =
  "Password must be at least 8 characters, with 1 uppercase, 1 lowercase, and 1 number.";

/** The same rule, prefixed for the server-side error block. */
export const WEAK_PASSWORD_ERROR = `Weak password. ${WEAK_PASSWORD_MESSAGE}`;

/**
 * Password strength check: at least `PASSWORD_MIN_LENGTH` characters, with at
 * least one uppercase letter, one lowercase letter and one number.
 *
 * Used on both sides of the wire -- the forms reject a weak password before
 * the request goes out, and the server actions re-check it so a client that
 * skips the check cannot create a weak account.
 */
export function isStrongPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
