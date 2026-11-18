import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { OWNER_ONLY_PATHS, isOwnerOnlyPath } from "../lib/team";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

test("the session endpoint is owner-scoped and never trusts a body id", () => {
  const route = source("app/api/whatsapp/session/route.ts");

  // `/api` is skipped by the proxy, so the route guard is the only protection.
  assert.match(route, /requireOwnerApi\(\)/);
  assert.match(route, /resolveWhatsAppBusinessId\(/);
  assert.match(route, /status: 403/);
  assert.match(route, /FORBIDDEN_MESSAGE/);

  // All three verbs exist.
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function DELETE/);
});

test("POST starts pairing without wiping a paired identity", () => {
  const route = source("app/api/whatsapp/session/route.ts");
  const post = route.slice(
    route.indexOf("export async function POST"),
    route.indexOf("export async function GET"),
  );

  assert.match(post, /\.upsert\(/);
  assert.match(post, /status: "CONNECTING"/);
  // A stale code must not be shown while the new socket pairs.
  assert.match(post, /qrCode: null/);
  // Pressing Connect cancels a pending Disconnect.
  assert.match(post, /logoutRequestedAt: null/);
  // Re-pairing must not delete `creds` — a paired line reconnects without a QR.
  assert.doesNotMatch(post, /creds:/);
  assert.match(post, /Response\.json\(\{ success: true \}\)/);
});

test("GET is the polling read and has a first-visit answer", () => {
  const route = source("app/api/whatsapp/session/route.ts");
  const get = route.slice(
    route.indexOf("export async function GET"),
    route.indexOf("export async function DELETE"),
  );

  assert.match(get, /searchParams\.get\("businessId"\)/);
  assert.match(get, /findUnique\(/);
  assert.match(get, /status: true/);
  assert.match(get, /qrCode: true/);
  assert.match(get, /phoneNumber: true/);
  // No row reads as DISCONNECTED via the shared serializer.
  assert.match(get, /serializeWhatsAppSession\(row\)/);
});

test("DELETE wipes the identity through a logout request, not a bare status", () => {
  const route = source("app/api/whatsapp/session/route.ts");
  const del = route.slice(route.indexOf("export async function DELETE"));

  assert.match(del, /logoutRequestedAt: new Date\(\)/);
  assert.match(del, /creds: Prisma\.DbNull/);
  assert.match(del, /status: "DISCONNECTED"/);
  // A missing row must not turn Disconnect into a 500.
  assert.match(del, /updateMany\(/);
});

test("the settings page renders the QR and polls the endpoint", () => {
  const page = source("app/(dashboard)/settings/whatsapp/page.tsx");

  assert.match(page, /^"use client";/);
  assert.match(page, /from "qrcode\.react"/);
  assert.match(page, /QRCodeCanvas/);
  assert.match(page, /value=\{qrValue\}/);

  // A 2-3 second loop, cleaned up on unmount.
  assert.match(page, /POLL_MS = 3_000/);
  assert.match(page, /setInterval\(/);
  assert.match(page, /clearInterval\(timer\)/);
  assert.match(page, /cache: "no-store"/);

  // All four states are handled.
  for (const status of [
    "CONNECTED",
    "CONNECTING",
    "QR_READY",
    "DISCONNECTED",
  ]) {
    assert.ok(page.includes(`"${status}"`), `${status} has a UI state`);
  }

  // The copy the owner acts on.
  assert.match(page, /Connect WhatsApp/);
  assert.match(page, /Connected as \{formatPhone\(session\.phoneNumber\)\}/);
  assert.match(page, /Disconnect/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /method: "DELETE"/);
});

test("only the owner can open or call the WhatsApp settings", () => {
  assert.equal(isOwnerOnlyPath("/settings/whatsapp"), true);
  assert.equal(isOwnerOnlyPath("/settings/whatsapp/devices"), true);
  assert.equal(isOwnerOnlyPath("/settings/whatsappx"), false);
  assert.ok(
    (OWNER_ONLY_PATHS as readonly string[]).includes("/settings/whatsapp"),
  );

  // Reachable from the dashboard, and hidden from staff by the same rule.
  assert.match(
    source("components/dashboard/sidebar.tsx"),
    /href: "\/settings\/whatsapp"/,
  );
  assert.match(
    source("app/(dashboard)/settings/page.tsx"),
    /href="\/settings\/whatsapp"/,
  );
});

test("the logout-request column is in the schema and its migration", () => {
  assert.match(
    source("prisma/schema.prisma"),
    /logoutRequestedAt\s+DateTime\?/,
  );

  const sql = source(
    "prisma/migrations/20261118000000_add_whatsapp_logout_request/migration.sql",
  );

  // `migrate deploy` runs on every build, so it must tolerate a hand-patched
  // database that already has the column.
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "logoutRequestedAt"/);
});

test("the QR renderer is a declared dependency", () => {
  const pkg = JSON.parse(source("package.json")) as {
    dependencies: Record<string, string>;
  };

  assert.ok(pkg.dependencies["qrcode.react"]);
});
