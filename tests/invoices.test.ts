import test from "node:test";
import assert from "node:assert/strict";

import {
  INVOICE_STATUSES,
  isInvoiceStatus,
  koboToNaira,
  nairaToKobo,
  RECEIPT_INVOICE_NOTE,
} from "../lib/invoices";

test("paid is a real invoice status the AI cannot reach", () => {
  assert.ok(INVOICE_STATUSES.includes("paid"));
  assert.equal(isInvoiceStatus("paid"), true);
  assert.equal(isInvoiceStatus("PAID"), false);
  assert.equal(isInvoiceStatus("refunded"), false);
  assert.equal(isInvoiceStatus(null), false);
});

test("money round-trips Naira through integer kobo", () => {
  assert.equal(nairaToKobo(25000), 2_500_000);
  assert.equal(nairaToKobo(25000.5), 2_500_050);
  assert.equal(koboToNaira(2_500_050), 25000.5);
  assert.equal(koboToNaira(nairaToKobo(1999.99)), 1999.99);
});

test("kobo arithmetic does not drift where floating-point Naira would", () => {
  // 0.1 + 0.2 !== 0.3 in binary floating point, but kobo are integers.
  assert.notEqual(0.1 + 0.2, 0.3);
  assert.equal(nairaToKobo(0.1) + nairaToKobo(0.2), nairaToKobo(0.3));
  // 0.07 * 100 is 7.000000000000001 in floating point.
  assert.equal(nairaToKobo(0.07), 7);
  // A kobo-bearing receipt total survives the trip to the Decimal(10,2) column.
  assert.equal(nairaToKobo(1234.56), 123456);
  assert.equal(koboToNaira(123456), 1234.56);
});

test("the receipt note is the exact owner-facing wording", () => {
  assert.equal(
    RECEIPT_INVOICE_NOTE,
    "Auto-generated from customer receipt. Needs owner verification.",
  );
});
