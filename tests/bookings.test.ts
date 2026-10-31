import test from "node:test";
import assert from "node:assert/strict";

import type { Booking } from "@prisma/client";

import {
  BOOKING_STATUSES,
  DEFAULT_BOOKING_DURATION_MINUTES,
  bookingEndTime,
  isBookingStatus,
  serializeBooking,
} from "../lib/bookings";
import {
  LAGOS_TIMEZONE,
  formatInLagosTimezone,
  parseLagosDateTime,
} from "../lib/timezone";

/** The instant a Lagos wall clock names, as ISO-8601 UTC. */
function asUtc(value: string): string | null {
  const parsed = parseLagosDateTime(value);
  return parsed ? parsed.toISOString() : null;
}

test("the Lagos zone is the IANA name, not an abbreviation", () => {
  assert.equal(LAGOS_TIMEZONE, "Africa/Lagos");
});

test("an instant renders as Lagos wall clock, never UTC", () => {
  // 09:00 UTC is 10:00 in Lagos (WAT, UTC+1).
  const rendered = formatInLagosTimezone(new Date("2026-11-03T09:00:00Z"));

  assert.match(rendered, /3 November 2026/);
  assert.match(rendered, /10:00/);
  assert.doesNotMatch(rendered, /09:00/);
  assert.match(rendered, /Tuesday/);
});

test("rendering crosses the date boundary with Lagos, not UTC", () => {
  // 23:30 UTC on the 25th is 00:30 on the 26th in Lagos.
  const rendered = formatInLagosTimezone(new Date("2026-12-25T23:30:00Z"));

  assert.match(rendered, /26 December 2026/);
  assert.match(rendered, /00:30/);
});

test("a zone-less wall clock is read as Lagos time, not server time", () => {
  // The same input must mean one moment everywhere, so this assertion holds on
  // a UTC CI box and on a Lagos laptop alike.
  assert.equal(asUtc("2026-11-03T10:00"), "2026-11-03T09:00:00.000Z");
  assert.equal(asUtc("2026-11-03 10:00"), "2026-11-03T09:00:00.000Z");
  assert.equal(asUtc(" 2026-11-03T10:00 "), "2026-11-03T09:00:00.000Z");
  assert.equal(asUtc("2026-11-03T10:00:00"), "2026-11-03T09:00:00.000Z");
  assert.equal(asUtc("2026-11-03T10:00:00.250"), "2026-11-03T09:00:00.250Z");
  assert.equal(asUtc("2026-11-03T10:00:00.5"), "2026-11-03T09:00:00.500Z");
});

test("an explicit offset is honoured as written", () => {
  assert.equal(asUtc("2026-11-03T10:00:00Z"), "2026-11-03T10:00:00.000Z");
  assert.equal(
    asUtc("2026-11-03T10:00:00+01:00"),
    "2026-11-03T09:00:00.000Z",
  );
  assert.equal(
    asUtc("2026-11-03T05:00:00-05:00"),
    "2026-11-03T10:00:00.000Z",
  );
});

test("Lagos keeps one offset all year, so January and July agree", () => {
  // Nigeria has no daylight saving: both months are UTC+1.
  assert.equal(asUtc("2026-01-15T10:00"), "2026-01-15T09:00:00.000Z");
  assert.equal(asUtc("2026-07-15T10:00"), "2026-07-15T09:00:00.000Z");
  // And a slot just after midnight lands on the previous UTC day.
  assert.equal(asUtc("2026-07-15T00:30"), "2026-07-14T23:30:00.000Z");
});

test("impossible or incomplete date-times are rejected", () => {
  for (const value of [
    "",
    "   ",
    "tomorrow at 10",
    "2026-11-03", // a booking needs a time, not just a day
    "2026-02-31T10:00", // Date would roll this over to 3 March
    "2026-13-01T10:00",
    "2026-00-10T10:00",
    "2026-11-03T25:00",
    "2026-11-03T10:60",
    "03/11/2026 10:00",
  ]) {
    assert.equal(parseLagosDateTime(value), null, `should reject ${value}`);
  }
});

test("the Lagos wall clock survives a parse/format round trip", () => {
  const parsed = parseLagosDateTime("2026-11-03T10:00");
  assert.ok(parsed);

  const rendered = formatInLagosTimezone(parsed);
  assert.match(rendered, /10:00/);
  assert.match(rendered, /3 November 2026/);
});

test("booking statuses are the three lifecycle values", () => {
  assert.deepEqual([...BOOKING_STATUSES], ["PENDING", "CONFIRMED", "CANCELLED"]);

  for (const status of BOOKING_STATUSES) {
    assert.equal(isBookingStatus(status), true);
  }
  for (const other of ["pending", "PAID", "", " CANCELLED", null, 42, undefined]) {
    assert.equal(isBookingStatus(other), false, `should reject ${String(other)}`);
  }
});

test("a booking ends one hour after it starts by default", () => {
  assert.equal(DEFAULT_BOOKING_DURATION_MINUTES, 60);

  const start = new Date("2026-11-03T09:00:00Z");
  const end = bookingEndTime(start);
  assert.equal(end.toISOString(), "2026-11-03T10:00:00.000Z");

  // The input is not mutated, and an explicit duration is respected.
  assert.equal(start.toISOString(), "2026-11-03T09:00:00.000Z");
  assert.equal(
    bookingEndTime(start, 30).toISOString(),
    "2026-11-03T09:30:00.000Z",
  );
});

test("a serialized booking carries UTC instants plus their Lagos rendering", () => {
  const startTime = parseLagosDateTime("2026-12-25T23:00");
  assert.ok(startTime);

  const booking: Booking = {
    id: "bk_1",
    businessId: "biz_1",
    customerId: "cus_1",
    serviceName: "Haircut",
    startTime,
    endTime: bookingEndTime(startTime),
    status: "PENDING",
    notes: null,
    createdAt: new Date("2026-12-20T08:00:00Z"),
  };

  const view = serializeBooking(booking);

  assert.equal(view.startTime, "2026-12-25T22:00:00.000Z");
  assert.equal(view.endTime, "2026-12-25T23:00:00.000Z");
  assert.equal(view.createdAt, "2026-12-20T08:00:00.000Z");
  assert.equal(view.timezone, "Africa/Lagos");
  assert.match(view.startTimeLagos, /25 December 2026/);
  assert.match(view.startTimeLagos, /23:00/);
  // The hour rolls into the next Lagos day while staying inside one UTC day.
  assert.match(view.endTimeLagos, /26 December 2026/);
  assert.match(view.endTimeLagos, /00:00/);
  assert.equal(view.status, "PENDING");
  assert.equal(view.notes, null);
});
