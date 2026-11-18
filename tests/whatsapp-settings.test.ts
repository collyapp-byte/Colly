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
  // The answer carries the row it wrote, so the page's pairing clock restarts.
  assert.match(post, /success: true/);
  assert.match(post, /session: serializeWhatsAppSessionSnapshot\(row\)/);
  assert.match(post, /updatedAt: true/);
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
  // `updatedAt` is the worker's last write: the stall detector needs it.
  assert.match(get, /updatedAt: true/);
  // No row reads as DISCONNECTED via the shared serializer.
  assert.match(get, /serializeWhatsAppSessionSnapshot\(row\)/);
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

test("the shared panel renders the QR and the hook polls the endpoint", () => {
  const page = source("app/(dashboard)/settings/whatsapp/page.tsx");
  const hook = source("components/channels/use-whatsapp-session.ts");
  const panel = source("components/channels/whatsapp-panel.tsx");

  // One implementation: the old settings page is now a thin wrapper over the
  // same components `/channels` renders.
  assert.match(page, /^"use client";/);
  assert.match(page, /useWhatsAppSession/);
  assert.match(page, /<WhatsAppPanel state=\{state\}/);

  assert.match(panel, /^"use client";/);
  assert.match(panel, /from "qrcode\.react"/);
  assert.match(panel, /QRCodeCanvas/);
  assert.match(panel, /value=\{qrValue\}/);

  // A 3-second loop, cleaned up on unmount.
  assert.match(hook, /WHATSAPP_POLL_MS = 3_000/);
  assert.match(hook, /setInterval\(/);
  assert.match(hook, /clearInterval\(timer\)/);
  assert.match(hook, /cache: "no-store"/);

  // All four states are handled across the shared pair of files.
  const shared = `${hook}\n${panel}`;
  for (const status of [
    "CONNECTED",
    "CONNECTING",
    "QR_READY",
    "DISCONNECTED",
  ]) {
    assert.ok(shared.includes(`"${status}"`), `${status} has a UI state`);
  }

  // The copy the owner acts on.
  assert.match(panel, /Connect WhatsApp/);
  assert.match(panel, /Connected as \{formatPhone\(session\.phoneNumber\)\}/);
  assert.match(panel, /Disconnect/);
  assert.match(hook, /method: "POST"/);
  assert.match(hook, /method: "DELETE"/);
});

test("a pairing that never starts can always be retried or cancelled", () => {
  const hook = source("components/channels/use-whatsapp-session.ts");
  const panel = source("components/channels/whatsapp-panel.tsx");
  const page = source("app/(dashboard)/settings/whatsapp/page.tsx");
  const channels = source("lib/channels.ts");

  // The 45-second rule lives in lib/whatsapp-pairing.ts and the hook reads it
  // from the API rather than from `Date.now()` in the browser.
  assert.match(hook, /PAIRING_TIMEOUT_MS/);
  assert.match(hook, /pairingElapsedSeconds\(session\)/);
  assert.match(hook, /const stalled = session\?\.stalled === true;/);

  // Both escape hatches exist while the pairing is starting.
  assert.match(panel, /Retry \/ Reconnect/);
  assert.match(hook, /const cancelPairing = useCallback\(async \(\) => \{/);
  assert.match(panel, /PAIRING SERVICE NOT RESPONDING/);
  // The badge stops claiming "Starting" once the worker is silent.
  assert.match(channels, /"No response"/);
  assert.match(page, /whatsappStatusLabel\(status, stalled\)/);
  assert.match(page, /<ChannelStatusBadge/);

  // Retry re-asks the worker; Cancel raises the logout request the worker reads.
  assert.match(panel, /onClick=\{\(\) => void connect\(\)\}/);
  assert.match(panel, /onClick=\{\(\) => void cancelPairing\(\)\}/);
  assert.match(hook, /method: "DELETE"/);

  // A failed poll/read also has a way forward instead of a dead error box.
  assert.match(panel, /Try again/);
});

test("the worker has a dev runner, because pairing needs a live process", () => {
  const pkg = JSON.parse(source("package.json")) as {
    scripts: Record<string, string>;
  };

  // The long-lived worker and its one-sweep smoke test.
  assert.equal(pkg.scripts["worker:whatsapp"], "tsx workers/whatsapp-worker.ts");
  assert.match(pkg.scripts["worker:whatsapp:once"], /--once/);

  // `next dev` alone can never advance a CONNECTING row; this starts both.
  assert.equal(pkg.scripts["dev:all"], "node scripts/dev-with-worker.cjs");

  const launcher = source("scripts/dev-with-worker.cjs");
  assert.match(launcher, /workers", "whatsapp-worker\.ts"/);
  assert.match(launcher, /"next", "dist", "bin", "next"/);
  assert.match(launcher, /stopping the other process/);
});

test("only the owner can open or call the WhatsApp settings", () => {
  assert.equal(isOwnerOnlyPath("/settings/whatsapp"), true);
  assert.equal(isOwnerOnlyPath("/settings/whatsapp/devices"), true);
  assert.equal(isOwnerOnlyPath("/settings/whatsappx"), false);
  assert.ok(
    (OWNER_ONLY_PATHS as readonly string[]).includes("/settings/whatsapp"),
  );

  // The sidebar row is the Channels hub now. It is open to staff (reading
  // status is not a privileged action); pairing inside it is not.
  assert.equal(isOwnerOnlyPath("/channels"), false);
  assert.match(
    source("components/dashboard/sidebar.tsx"),
    /href: "\/channels"/,
  );
  assert.doesNotMatch(
    source("components/dashboard/sidebar.tsx"),
    /href: "\/settings\/whatsapp"/,
    "WhatsApp must not keep a standalone sidebar row",
  );
  // The old bookmark target still works and points at the hub.
  assert.match(
    source("app/(dashboard)/settings/whatsapp/page.tsx"),
    /href="\/channels"/,
  );
  assert.match(
    source("app/(dashboard)/settings/page.tsx"),
    /href="\/channels"/,
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
