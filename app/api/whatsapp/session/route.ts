import { Prisma } from "@prisma/client";

import { requireOwnerApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  resolveWhatsAppBusinessId,
  serializeWhatsAppSessionSnapshot,
} from "@/lib/whatsapp-session";

/**
 * The WhatsApp pairing endpoint behind Settings → WhatsApp.
 *
 * The API process does not own a socket — `workers/whatsapp-worker.ts` does —
 * so every call here is a database request, and the worker's 5-second sweep
 * turns it into action:
 *
 *   POST   → status CONNECTING; the worker opens a socket and emits a QR.
 *   GET    → the current row for the dashboard's polling loop.
 *   DELETE → status DISCONNECTED + `logoutRequestedAt`; the worker calls
 *            `sock.logout()` on the live socket, wipes the stored credentials
 *            and clears the flag. Clearing `creds` here alone would leave the
 *            in-memory socket answering customers, which is why the flag
 *            exists.
 *
 * Ownership: the tenant always comes from the session (`requireOwnerApi`), and
 * a `businessId` in the body/query can only repeat it. The proxy deliberately
 * skips `/api`, so this guard is what stops a staff session — or a crafted
 * request for another tenant's id — from pairing or unlinking a line.
 */

const FORBIDDEN_MESSAGE =
  "You can only manage your own business's WhatsApp line.";

function forbidden() {
  return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
}

/** Starts (or restarts) pairing for the caller's business. */
export async function POST(request: Request) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    businessId?: unknown;
  } | null;

  const businessId = resolveWhatsAppBusinessId(
    auth.user.businessId,
    body?.businessId,
  );
  if (!businessId) return forbidden();

  const row = await prisma.whatsAppSession.upsert({
    where: { businessId },
    update: {
      status: "CONNECTING",
      // A code from a previous attempt is already stale; the worker writes the
      // fresh one as the socket produces it.
      qrCode: null,
      // Pressing Connect is an explicit "pair me now": it cancels a pending
      // Disconnect that has not been picked up yet.
      logoutRequestedAt: null,
    },
    create: { businessId, status: "CONNECTING" },
    // Only what the connect screen reads: the payload must never carry `creds`.
    select: {
      status: true,
      qrCode: true,
      phoneNumber: true,
      updatedAt: true,
    },
  });

  // Returning the row (not just `success`) restarts the page's pairing clock:
  // `updatedAt` is fresh, so a retry cannot render as "stalled" straight away.
  return Response.json({
    success: true,
    session: serializeWhatsAppSessionSnapshot(row),
  });
}

/** The dashboard's polling read. */
export async function GET(request: Request) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;

  const requested = new URL(request.url).searchParams.get("businessId");
  const businessId = resolveWhatsAppBusinessId(
    auth.user.businessId,
    requested,
  );
  if (!businessId) return forbidden();

  const row = await prisma.whatsAppSession.findUnique({
    where: { businessId },
    // `updatedAt` is the worker's last write, so this read can also answer
    // "is the pairing service even alive?" — see `isPairingStalled()`.
    select: { status: true, qrCode: true, phoneNumber: true, updatedAt: true },
  });

  // A tenant that never pressed Connect has no row; the client reads that as
  // DISCONNECTED instead of handling a 404.
  return Response.json(serializeWhatsAppSessionSnapshot(row));
}

/** Unlinks the device and asks the worker to close the socket. */
export async function DELETE(request: Request) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    businessId?: unknown;
  } | null;

  const businessId = resolveWhatsAppBusinessId(
    auth.user.businessId,
    body?.businessId,
  );
  if (!businessId) return forbidden();

  // `updateMany` rather than `update`: disconnecting a tenant that has no
  // session row is a no-op, not a 500.
  await prisma.whatsAppSession.updateMany({
    where: { businessId },
    data: {
      status: "DISCONNECTED",
      qrCode: null,
      phoneNumber: null,
      // Stored Signal keys are the device identity; a logout throws them away.
      creds: Prisma.DbNull,
      logoutRequestedAt: new Date(),
    },
  });

  return Response.json({ success: true });
}
