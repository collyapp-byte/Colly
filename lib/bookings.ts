import type { Booking } from "@prisma/client";

import {
  formatInLagosTimezone,
  LAGOS_TIMEZONE,
  parseLagosDateTime,
} from "@/lib/timezone";

/**
 * Booking lifecycle. A new booking starts at `PENDING` (the schema default) and
 * moves to `CONFIRMED` or `CANCELLED`; the values are strings, like
 * `Invoice.status` and `Customer.dealStatus`.
 */
export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    typeof value === "string" &&
    (BOOKING_STATUSES as readonly string[]).includes(value)
  );
}

/** Slot length used when a caller does not send one: one hour. */
export const DEFAULT_BOOKING_DURATION_MINUTES = 60;

const MINUTE_MS = 60 * 1000;

/**
 * When a slot that starts at `start` and lasts `durationMinutes` ends.
 *
 * Pure arithmetic on the absolute instant, so it is immune to the timezone
 * question: 10:00 WAT + 1 hour is 11:00 WAT, and across a midnight boundary the
 * Lagos rendering (not the stored value) is what rolls over.
 */
export function bookingEndTime(
  start: Date,
  durationMinutes = DEFAULT_BOOKING_DURATION_MINUTES,
): Date {
  return new Date(start.getTime() + durationMinutes * MINUTE_MS);
}

/** Longest service name an appointment may carry. */
export const MAX_BOOKING_SERVICE_LENGTH = 120;

const MINUTES_PER_DAY = 24 * 60;

/**
 * Whole nights between two instants — the unit a hotel quotes a stay in.
 *
 * Pure arithmetic, like `bookingEndTime()`, so the answer does not depend on the
 * runtime's timezone: 14:00 WAT on 5 November to 11:00 WAT on 8 November is
 * three nights (stored instants 13:00Z → 10:00Z). `Math.round` keeps a check-out
 * an hour earlier than the check-in time from counting as a lost night.
 */
export function bookingNights(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (MINUTES_PER_DAY * MINUTE_MS));
}

/** `YYYY-MM-DD`, tolerating a one-digit month or day. */
const BOOKING_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Canonicalises a date to `YYYY-MM-DD`.
 *
 * The AI tool passes the model's `date` argument through here, so "2026-11-5"
 * and "2026-11-05" mean the same day. Only the shape is checked: whether that
 * day exists (31 February) is decided by `parseBookingSlot()`, which reads the
 * result as a Lagos wall clock.
 */
export function normalizeBookingDate(value: string): string | null {
  const match = BOOKING_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Canonicalises a time to 24-hour `HH:MM`.
 *
 * Accepts what a model or a person actually writes — "14:00", "14:00:00",
 * "2pm", "2:30 pm", "9 AM" — because the model is asked for `HH:MM` but does
 * not always produce it. Returns null for anything that is not a time of day.
 */
export function normalizeBookingTime(value: string): string | null {
  const match =
    /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const minutes = match[2] ? Number(match[2]) : 0;
  if (minutes > 59) {
    return null;
  }

  let hours = Number(match[1]);
  const meridiem = match[3]?.toLowerCase();

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null;
    }
    hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * The instant a date + time pair names, in Lagos time.
 *
 * The pair is normalised first (so "2pm" and "14:00" agree and "2026-11-5" is
 * padded), then handed to `parseLagosDateTime()` as a zone-less wall clock,
 * which reads it as Lagos time on a UTC server too. Returns null when either
 * half is unusable or the day does not exist in that month — a booking must
 * never fall back to the runtime's own zone.
 */
export function parseBookingSlot(date: string, time: string): Date | null {
  const normalizedDate = normalizeBookingDate(date);
  const normalizedTime = normalizeBookingTime(time);
  if (!normalizedDate || !normalizedTime) {
    return null;
  }

  return parseLagosDateTime(`${normalizedDate}T${normalizedTime}`);
}


/**
 * A booking as the API returns it.
 *
 * The stored instants are echoed as ISO-8601 UTC strings (unambiguous for any
 * client) and, because every surface shows Lagos time, the rendering is done
 * here once — `startTimeLagos`/`endTimeLagos` come from
 * `formatInLagosTimezone()`, never from a client's `toLocaleString()`.
 */
export type BookingView = {
  id: string;
  businessId: string;
  customerId: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  createdAt: string;
  /** The zone the two `...Lagos` strings are rendered in. */
  timezone: string;
  startTimeLagos: string;
  endTimeLagos: string;
};

export function serializeBooking(booking: Booking): BookingView {
  return {
    id: booking.id,
    businessId: booking.businessId,
    customerId: booking.customerId,
    serviceName: booking.serviceName,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    status: booking.status,
    notes: booking.notes,
    createdAt: booking.createdAt.toISOString(),
    timezone: LAGOS_TIMEZONE,
    startTimeLagos: formatInLagosTimezone(booking.startTime),
    endTimeLagos: formatInLagosTimezone(booking.endTime),
  };
}
