import type { Booking } from "@prisma/client";

import { formatInLagosTimezone, LAGOS_TIMEZONE } from "@/lib/timezone";

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
