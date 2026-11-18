/**
 * The pairing clock for Settings → WhatsApp.
 *
 * Pressing Connect only writes `WhatsAppSession.status = "CONNECTING"`; the
 * standalone worker (`npm run worker:whatsapp`) is what turns that row into a
 * socket and a QR code. Nothing in the API process can do it, so when the worker
 * is not running the row would sit on CONNECTING forever and the dashboard would
 * spin on "Starting" with no way out.
 *
 * This module is the one place that decides "the worker never answered":
 * a CONNECTING row with no QR whose `updatedAt` has not moved for longer than
 * `PAIRING_TIMEOUT_MS` is treated as a stale pairing. The read is deliberately
 * passive — it never writes the row, because a slow boot is not a dead one and
 * the worker remains the single writer of `status`.
 *
 * Deliberately dependency-free (no Prisma, no React) so both the polling route
 * and the client component can import it, and so it is unit-testable.
 */

/** How long a pairing may sit on CONNECTING without a QR before it is stale. */
export const PAIRING_TIMEOUT_MS = 45_000;

/** The fields of a session row this module needs. */
export type PairingSnapshot = {
  /** `WhatsAppSession.status`, already narrowed by the caller if it wants. */
  status: string;
  qrCode: string | null;
  /** ISO stamp of the worker's last write; null when the row does not exist. */
  updatedAt: string | null;
};

/**
 * Age of the worker's last write, in milliseconds, clamped at zero so a small
 * client/server clock skew cannot produce a negative wait.
 *
 * `null` when the row has no usable stamp: an unparseable value must not be read
 * as "stalled", because that would show an error on a healthy session.
 */
export function pairingAgeMs(
  session: PairingSnapshot,
  now: number = Date.now(),
): number | null {
  if (!session.updatedAt) return null;

  const stamp = Date.parse(session.updatedAt);
  if (!Number.isFinite(stamp)) return null;

  return Math.max(0, now - stamp);
}

/** Whole seconds since the worker last wrote the row (0 when unknown). */
export function pairingElapsedSeconds(
  session: PairingSnapshot,
  now: number = Date.now(),
): number {
  const age = pairingAgeMs(session, now);
  return age === null ? 0 : Math.floor(age / 1000);
}

/**
 * True when a Connect press has produced nothing at all for too long.
 *
 * Only CONNECTING qualifies: QR_READY means the worker is alive and the owner
 * simply has not scanned yet, CONNECTED needs no timer, and DISCONNECTED has no
 * attempt to wait on. A QR that already exists also clears the timer, even if
 * the status has not caught up yet — the owner can act on it.
 */
export function isPairingStalled(
  session: PairingSnapshot,
  now: number = Date.now(),
): boolean {
  if (session.status !== "CONNECTING") return false;
  if (typeof session.qrCode === "string" && session.qrCode.length > 0) {
    return false;
  }

  const age = pairingAgeMs(session, now);
  return age !== null && age >= PAIRING_TIMEOUT_MS;
}
