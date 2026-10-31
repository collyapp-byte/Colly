/**
 * Africa/Lagos (WAT, UTC+1) time handling.
 *
 * Colly's businesses are Nigerian, so every scheduling surface speaks Lagos time
 * even though the database stores absolute instants (see the `Booking` model in
 * prisma/schema.prisma). This module exists to make the two classic mistakes
 * impossible:
 *
 * 1. Rendering — never format a stored instant with the runtime's own zone
 *    (`toLocaleString()` without `timeZone`). A serverless function runs in UTC,
 *    so a 10:00 Lagos appointment would read back as 10:00 "local" (09:00 WAT);
 *    a browser in another zone would show something else again.
 *    `formatInLagosTimezone()` pins the zone explicitly.
 * 2. Parsing — never hand a zone-less string to `new Date()`. "2026-11-03T10:00"
 *    is parsed as *the runtime's* local time: 10:00 UTC on a UTC server (which
 *    is 11:00 in Lagos) but 09:00 UTC on a Lagos laptop. The same request body
 *    would book two different moments. `parseLagosDateTime()` treats it as Lagos
 *    wall clock and returns the matching instant.
 *
 * Nigeria has kept one offset (UTC+1) with no daylight saving since 1919, but
 * nothing here hardcodes `+01:00`: the offset is read back from `Intl`, so the
 * module stays correct if the tz database ever changes.
 */

/** The IANA zone every scheduling surface reads and writes in. */
export const LAGOS_TIMEZONE = "Africa/Lagos";

/**
 * Built once: `Intl.DateTimeFormat` construction is the expensive part, and a
 * formatter is immutable. `Intl` also caches internally per zone + options.
 */
const lagosFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: LAGOS_TIMEZONE,
  dateStyle: "full",
  timeStyle: "short",
});

/**
 * Renders an instant the way a Lagos business reads it, e.g.
 * `"Tuesday, 3 November 2026 at 10:00"`.
 *
 * Throws `RangeError` for an invalid `Date`, exactly like `Intl.DateTimeFormat`
 * — a silent "Invalid Date" string would hide the bug that produced it.
 */
export function formatInLagosTimezone(date: Date): string {
  return lagosFormatter.format(date);
}

/** Wall clock in Lagos, split into the numbers the offset maths needs. */
const LAGOS_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: LAGOS_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * How far ahead of UTC Lagos is at the given instant, in milliseconds.
 *
 * Derived from `Intl` rather than assumed, and evaluated *at that instant* so a
 * future DST rule would be honoured. Lagos' offset is whole hours, hence the
 * second-level floor (the formatter has no millisecond field).
 */
function lagosOffsetMs(utcMs: number): number {
  const parts = LAGOS_PARTS_FORMATTER.formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((entry) => entry.type === type);
    return found ? Number(found.value) : 0;
  };

  // Re-read the Lagos wall clock as if it were UTC: the difference is the offset.
  const wallClockAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );

  return wallClockAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/** A string that already names its zone (`Z`, `+01:00`, `-0500`). */
const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** `YYYY-MM-DDTHH:mm`, optionally `:ss`, optionally `.S`/`.SS`/`.SSS`. */
const WALL_CLOCK_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/**
 * Parses a booking time into the instant it names.
 *
 * - A string that carries an explicit offset (`"2026-11-03T10:00:00Z"`,
 *   `"2026-11-03T10:00:00+01:00"`) is honoured as written — the caller said
 *   which moment it meant.
 * - A zone-less wall clock (`"2026-11-03T10:00"`) is read as **Lagos** time, so
 *   it means 09:00 UTC regardless of where the server runs. This is the fix for
 *   the `new Date()` trap described at the top of the file.
 *
 * Returns `null` for anything that is not a real date-time: a nonsense string, a
 * date with no time (`"2026-11-03"` — a booking needs a slot), or an impossible
 * calendar date (`"2026-02-31T10:00"`, which `Date` would silently roll over to
 * 3 March).
 */
export function parseLagosDateTime(value: string): Date | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (EXPLICIT_OFFSET_PATTERN.test(raw)) {
    const explicit = new Date(raw);
    return Number.isNaN(explicit.getTime()) ? null : explicit;
  }

  const match = WALL_CLOCK_PATTERN.exec(raw);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, fraction] = match;
  const seconds = Number(second ?? "0");
  const milliseconds = fraction ? Number(fraction.padEnd(3, "0")) : 0;

  // The wall clock the caller wrote, read as if it were UTC. `Date.UTC` maps any
  // out-of-range number onto the neighbouring month/day/hour, so the components
  // are compared back below to reject dates that do not exist.
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    seconds,
    milliseconds,
  );

  const roundTrip = new Date(wallClockAsUtc);
  if (
    Number.isNaN(roundTrip.getTime()) ||
    roundTrip.getUTCFullYear() !== Number(year) ||
    roundTrip.getUTCMonth() !== Number(month) - 1 ||
    roundTrip.getUTCDate() !== Number(day) ||
    roundTrip.getUTCHours() !== Number(hour) ||
    roundTrip.getUTCMinutes() !== Number(minute) ||
    roundTrip.getUTCSeconds() !== seconds
  ) {
    return null;
  }

  // Two passes: the offset at the naive instant, then at the corrected instant,
  // so estimating near an offset change cannot land an hour off.
  const firstGuess = wallClockAsUtc - lagosOffsetMs(wallClockAsUtc);
  const offset = lagosOffsetMs(firstGuess);

  return new Date(wallClockAsUtc - offset);
}
