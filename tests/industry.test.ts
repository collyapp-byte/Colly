import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DEFAULT_INDUSTRY,
  INDUSTRIES,
  INDUSTRY_LABELS,
  industryFromSlug,
  industrySlug,
  isIndustry,
} from "../lib/business";
import { bookingNights, parseBookingSlot } from "../lib/bookings";
import { PUBLIC_PAGES } from "../lib/site";
import { isPublicRoute } from "../lib/public-routes";

/**
 * The hotel vertical has three separate halves that must agree:
 *
 * 1. the vocabulary — `Business.industry` is one of `INDUSTRIES`, every
 *    existing row is "RETAIL", and a signup link spells it lower case;
 * 2. the stay arithmetic — a check-out day is whole nights, and the Lagos
 *    wall clock still maps to one UTC instant (tests/bookings.test.ts owns the
 *    parser itself);
 * 3. the routing contract — `/hotels` is a real, indexable, session-free page
 *    whose call to action carries `?industry=hotel`, otherwise a hotel owner who
 *    signs up from the landing page silently gets the retail persona.
 */

test("industry vocabulary matches the schema default", () => {
  assert.deepEqual([...INDUSTRIES], ["RETAIL", "HOTEL", "SERVICES"]);
  assert.equal(DEFAULT_INDUSTRY, "RETAIL");

  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(
    schema,
    /industry\s+String\s+@default\("RETAIL"\)/,
    "Business.industry must keep the RETAIL default the app falls back to",
  );

  for (const industry of INDUSTRIES) {
    assert.equal(typeof INDUSTRY_LABELS[industry], "string");
    assert.ok(INDUSTRY_LABELS[industry].length > 2);
  }
});

test("isIndustry only accepts the stored spelling", () => {
  for (const industry of INDUSTRIES) {
    assert.equal(isIndustry(industry), true);
    // The stored value is upper case; a lower-case slug is a URL form, not a
    // column value, so it is rejected here and normalised by industryFromSlug.
    assert.equal(isIndustry(industry.toLowerCase()), false);
  }

  assert.equal(isIndustry("hotel "), false);
  assert.equal(isIndustry("RESTAURANT"), false);
  assert.equal(isIndustry(""), false);
  assert.equal(isIndustry(null), false);
  assert.equal(isIndustry(undefined), false);
  assert.equal(isIndustry(7), false);
});

test("industryFromSlug normalises the signup link", () => {
  assert.equal(industryFromSlug("hotel"), "HOTEL");
  assert.equal(industryFromSlug("HOTEL"), "HOTEL");
  assert.equal(industryFromSlug(" Hotel "), "HOTEL");
  assert.equal(industryFromSlug("retail"), "RETAIL");
  assert.equal(industryFromSlug("services"), "SERVICES");
  // The spelling a person types.
  assert.equal(industryFromSlug("service"), "SERVICES");

  // Unknown or missing: the Business row keeps the schema default.
  assert.equal(industryFromSlug("hospitality"), null);
  assert.equal(industryFromSlug(""), null);
  assert.equal(industryFromSlug(undefined), null);
  assert.equal(industryFromSlug(["hotel"]), null);

  // Every industry survives the round trip the links rely on.
  for (const industry of INDUSTRIES) {
    assert.equal(industryFromSlug(industrySlug(industry)), industry);
  }
});

test("bookingNights counts whole nights a stay spans", () => {
  // 5 Nov 14:00 → 8 Nov 11:00 Lagos: 69 hours, quoted as three nights.
  const checkIn = parseBookingSlot("2026-11-05", "14:00");
  const checkOut = parseBookingSlot("2026-11-08", "11:00");
  assert.ok(checkIn && checkOut);
  assert.equal(bookingNights(checkIn, checkOut), 3);

  // One night, check-in 14:00 → check-out 12:00 the next day.
  const oneNight = parseBookingSlot("2026-11-06", "12:00");
  assert.ok(oneNight);
  assert.equal(bookingNights(checkIn, oneNight), 1);

  // The same instant is zero nights, which is what `createBooking` refuses.
  assert.equal(bookingNights(checkIn, checkIn), 0);
});

test("the hotel persona is gated on the industry and asks for both dates", () => {
  const engine = readFileSync(
    new URL("../lib/chat-engine.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    engine,
    /HOTEL MODE: You are a hotel receptionist\./,
    "the persona the hotel page promises must be in the prompt",
  );
  assert.ok(
    engine.includes("Check-in Date and Check-out Date"),
    "a hotel booking needs both dates before anything is booked",
  );
  assert.ok(
    engine.includes("Do not book unless you have both dates."),
    "the rule that stops a one-date stay must stay verbatim",
  );
  // Only a validated "HOTEL" row switches the persona on; RETAIL and SERVICES
  // keep the generic sales-assistant prompt.
  assert.match(engine, /if \(business\.industry === "HOTEL"\)/);
  assert.ok(
    engine.includes('"checkOutDate"'),
    "the tool must accept the check-out day, or the second date is thrown away",
  );
});

test("/hotels is a public, sitemapped page that carries the industry into signup", () => {
  assert.ok(
    PUBLIC_PAGES.some((page) => page.path === "/hotels"),
    "/hotels must be in PUBLIC_PAGES (sitemap + canonical)",
  );
  // Without this, the proxy answers a crawler with a 307 to /login.
  assert.equal(isPublicRoute("/hotels"), true);

  const pagePath = new URL(
    "../app/(marketing)/hotels/page.tsx",
    import.meta.url,
  );
  assert.ok(existsSync(pagePath), "the hotel landing page must exist");

  const page = readFileSync(pagePath, "utf8");
  assert.ok(
    page.includes("/signup?role=business&industry=hotel"),
    "the hotel CTA must carry the industry so signup stores it",
  );
  assert.ok(page.includes('industry="HOTEL"'), "pricing must keep the industry");
  assert.ok(
    page.includes("The 24/7 AI Receptionist for"),
    "the hero keeps the positioning that answers 'AI receptionist for hotels'",
  );
});
