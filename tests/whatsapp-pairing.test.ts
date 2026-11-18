import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PAIRING_TIMEOUT_MS,
  isPairingStalled,
  pairingAgeMs,
  pairingElapsedSeconds,
} from "../lib/whatsapp-pairing";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

const NOW = Date.parse("2026-11-18T12:00:00.000Z");

/** An ISO stamp `secondsAgo` seconds before the fixed "now". */
function stamp(secondsAgo: number): string {
  return new Date(NOW - secondsAgo * 1000).toISOString();
}

test("the pairing timeout is a defined 45 seconds", () => {
  assert.equal(PAIRING_TIMEOUT_MS, 45_000);
});

test("a CONNECTING row with no QR goes stale after the timeout", () => {
  assert.equal(
    isPairingStalled(
      { status: "CONNECTING", qrCode: null, updatedAt: stamp(5) },
      NOW,
    ),
    false,
  );

  assert.equal(
    isPairingStalled(
      { status: "CONNECTING", qrCode: null, updatedAt: stamp(44) },
      NOW,
    ),
    false,
  );

  // Exactly at the boundary counts: the page must not wait a tick longer.
  assert.equal(
    PAIRING_TIMEOUT_MS,
    Date.parse(stamp(0)) - Date.parse(stamp(45)),
  );
  assert.equal(
    isPairingStalled(
      { status: "CONNECTING", qrCode: null, updatedAt: stamp(45) },
      NOW,
    ),
    true,
  );

  // The real bug this exists for: a row abandoned half an hour ago.
  assert.equal(
    isPairingStalled(
      { status: "CONNECTING", qrCode: null, updatedAt: stamp(1_930) },
      NOW,
    ),
    true,
  );
});

test("a QR or a settled status is never read as stalled", () => {
  // A code exists: the owner can act on it, whatever the age.
  assert.equal(
    isPairingStalled(
      { status: "CONNECTING", qrCode: "2@abc123", updatedAt: stamp(600) },
      NOW,
    ),
    false,
  );
  assert.equal(
    isPairingStalled(
      { status: "QR_READY", qrCode: "2@abc123", updatedAt: stamp(600) },
      NOW,
    ),
    false,
  );
  assert.equal(
    isPairingStalled(
      { status: "CONNECTED", qrCode: null, updatedAt: stamp(86_400) },
      NOW,
    ),
    false,
  );
  assert.equal(
    isPairingStalled(
      { status: "DISCONNECTED", qrCode: null, updatedAt: stamp(86_400) },
      NOW,
    ),
    false,
  );
});

test("a missing or unusable stamp is unknown, not stalled", () => {
  // No row at all: first visit.
  assert.equal(
    isPairingStalled(
      { status: "DISCONNECTED", qrCode: null, updatedAt: null },
      NOW,
    ),
    false,
  );
  assert.equal(
    isPairingStalled(
      { status: "CONNECTING", qrCode: null, updatedAt: null },
      NOW,
    ),
    false,
  );
  // A hand-edited column must not paint an error on a healthy session.
  assert.equal(
    isPairingStalled(
      { status: "CONNECTING", qrCode: null, updatedAt: "not a date" },
      NOW,
    ),
    false,
  );
  assert.equal(
    pairingAgeMs(
      { status: "CONNECTING", qrCode: null, updatedAt: "not a date" },
      NOW,
    ),
    null,
  );
});

test("the age is clamped, so a clock skew cannot show a negative wait", () => {
  // The server's stamp is "in the future" from the caller's clock.
  const future = new Date(NOW + 60_000).toISOString();

  assert.equal(
    pairingAgeMs(
      { status: "CONNECTING", qrCode: null, updatedAt: future },
      NOW,
    ),
    0,
  );
  assert.equal(
    pairingElapsedSeconds(
      { status: "CONNECTING", qrCode: null, updatedAt: future },
      NOW,
    ),
    0,
  );
  assert.equal(
    isPairingStalled(
      { status: "CONNECTING", qrCode: null, updatedAt: future },
      NOW,
    ),
    false,
  );
});

test("elapsed seconds are whole seconds, and 0 when unknown", () => {
  assert.equal(
    pairingElapsedSeconds(
      { status: "CONNECTING", qrCode: null, updatedAt: stamp(12.7) },
      NOW,
    ),
    12,
  );
  assert.equal(
    pairingElapsedSeconds(
      { status: "CONNECTING", qrCode: null, updatedAt: null },
      NOW,
    ),
    0,
  );
});

test("the API and the shared hook both go through the shared timeout", () => {
  const route = source("app/api/whatsapp/session/route.ts");
  const hook = source("components/channels/use-whatsapp-session.ts");
  const session = source("lib/whatsapp-session.ts");

  // The route answers with the pairing clock, and selects it from the row.
  assert.match(route, /serializeWhatsAppSessionSnapshot\(row\)/);
  assert.match(route, /updatedAt: true/);

  // The serializer is the only place `stalled` is decided.
  assert.match(session, /serializeWhatsAppSessionSnapshot/);
  assert.match(session, /isPairingStalled\(/);

  // The shared hook never re-implements the rule or trusts the browser clock.
  assert.match(hook, /from "@\/lib\/whatsapp-pairing"/);
  assert.match(hook, /PAIRING_TIMEOUT_MS/);
  assert.match(hook, /pairingElapsedSeconds\(session\)/);
  assert.match(hook, /session\?\.stalled === true/);
  // `/channels` and the old settings page both render that one implementation.
  assert.match(
    source("app/(dashboard)/channels/page.tsx"),
    /whatsappSessionViewFromRow/,
  );
  assert.match(
    source("app/(dashboard)/settings/whatsapp/page.tsx"),
    /useWhatsAppSession/,
  );
});
