/**
 * Standalone WhatsApp worker for Colly.
 *
 * Run it next to (or on another host from) `next dev` / `next start`:
 *
 *   npm run worker:whatsapp
 *
 * Why a separate process: a Baileys socket is a long-lived WebSocket with its
 * own auth session, QR pairing and reconnect loop. A Next.js route handler is a
 * short-lived request scope (and on most hosts a throwaway lambda), so hosting
 * the socket there would either drop the connection on every deploy or duplicate
 * it across instances. This file is the only place that imports Baileys.
 *
 * What it does:
 * - one in-memory `Map<businessId, socket>` for the whole process;
 * - auth state in Postgres (`WhatsAppSession.creds`) via `whatsapp-auth-state.ts`,
 *   so a restart does not force every tenant to re-scan a QR;
 * - inbound messages handed to `attachWhatsAppListener` (the metered engine,
 *   typing jitter included);
 * - status/QR/phone written through `setWhatsAppSessionStatus`;
 * - exponential-backoff reconnect, and a credential wipe on `loggedOut`;
 * - a 5-second poll of `WhatsAppSession` so a "connect my WhatsApp" request from
 *   the web app is picked up, and a boot sweep that re-establishes CONNECTED
 *   lines after a restart.
 *
 * `--once` runs a single sweep and exits: useful for a smoke test in CI or on a
 * new host, and it needs no WhatsApp credentials.
 *
 * NOT wired to a channel selector on purpose: WhatsApp remains a manual
 * onboarding path in this product (see `/api/waitlist`). A business gets a row
 * with `status: "CONNECTING"` when an operator starts its pairing.
 */

import "dotenv/config";

import makeWASocket, { DisconnectReason } from "@whiskeysockets/baileys";
import { Prisma } from "@prisma/client";
import pino from "pino";

import { prisma } from "@/lib/prisma";
import {
  attachWhatsAppListener,
  setWhatsAppSessionStatus,
  whatsappPhoneFromJid,
} from "@/lib/whatsapp-session";
import { createWhatsAppAuthState } from "./whatsapp-auth-state";
import {
  statusCodeFromError,
  WhatsAppSessionWorker,
  WHATSAPP_LOGGED_OUT_STATUS,
  type WhatsAppSessionHandle,
  type WhatsAppSessionSignal,
} from "./whatsapp-session-manager";

const DEFAULT_POLL_MS = 5_000;

/** The `WhatsAppSession.creds` column, as auth-state IO. */
function authIO(businessId: string) {
  return {
    load: async (): Promise<unknown | null> => {
      const row = await prisma.whatsAppSession.findUnique({
        where: { businessId },
        select: { creds: true },
      });

      return row?.creds ?? null;
    },
    save: async (state: { creds: unknown; keys: unknown }): Promise<void> => {
      // Already JSON-safe (BufferJSON); Prisma only needs the input type.
      const creds = state as unknown as Prisma.InputJsonValue;

      await prisma.whatsAppSession.upsert({
        where: { businessId },
        update: { creds },
        create: { businessId, creds },
      });
    },
    clear: async (): Promise<void> => {
      // DbNull writes SQL NULL and drops the number with it: after a logout the
      // old identity and the number it belonged to are both stale.
      await prisma.whatsAppSession.upsert({
        where: { businessId },
        update: { creds: Prisma.DbNull, phoneNumber: null },
        create: { businessId, status: "DISCONNECTED" },
      });
    },
  };
}

/**
 * Opens one socket for one tenant and routes everything into the manager.
 *
 * `connectionState: false` on the listener: this worker is the single writer of
 * the pairing state, so the library must not subscribe `connection.update` a
 * second time.
 */
async function connectTenant(
  businessId: string,
  onSignal: (signal: WhatsAppSessionSignal) => void,
): Promise<WhatsAppSessionHandle> {
  const auth = await createWhatsAppAuthState(authIO(businessId));

  const sock = makeWASocket({
    auth: auth.state,
    // Pairing is rendered in Colly's dashboard, never in a terminal.
    printQRInTerminal: false,
    // Message history is not needed to answer; skipping it keeps the first
    // connection cheap for a phone with years of chats.
    syncFullHistory: false,
    logger: pino({ level: "silent" }),
  });

  // Baileys rotates the Signal keys as messages arrive; every update is written
  // back to the row. A failed write is logged, never thrown into the socket.
  sock.ev.on("creds.update", () => {
    void auth.saveCreds().catch((error: unknown) => {
      console.error(
        `[whatsapp-worker] could not save credentials for ${businessId}`,
        error,
      );
    });
  });

  sock.ev.on("connection.update", (update) => {
    const ownId = sock.user?.id ?? auth.state.creds.me?.id;
    const statusCode = statusCodeFromError(update.lastDisconnect?.error);

    onSignal({
      connection: update.connection ?? null,
      qr: update.qr ?? null,
      phoneNumber: ownId ? whatsappPhoneFromJid(ownId) : null,
      // Map Boom's loggedOut onto the constant the manager compares with, so a
      // future Baileys rename cannot silently turn a logout into a retry loop.
      statusCode:
        statusCode === DisconnectReason.loggedOut
          ? WHATSAPP_LOGGED_OUT_STATUS
          : statusCode,
    });
  });

  attachWhatsAppListener({ sock, businessId, connectionState: false });

  return {
    close: () => {
      sock.end(undefined);
    },
    // The dashboard's Disconnect button ends in `sock.logout()`, which unlinks
    // the device on WhatsApp's side as well — `end()` alone would leave the
    // phone still showing Colly as a linked device.
    logout: async () => {
      await sock.logout();
    },
  };
}


const worker = new WhatsAppSessionWorker({
  setStatus: setWhatsAppSessionStatus,
  clearCreds: async (businessId: string) => {
    await authIO(businessId).clear();
  },
  listRequested: async ({ includeConnected }) => {
    const rows = await prisma.whatsAppSession.findMany({
      where: {
        status: includeConnected
          ? { in: ["CONNECTING", "CONNECTED", "QR_READY"] }
          : { in: ["CONNECTING", "QR_READY"] },
      },
      select: { businessId: true },
    });

    return rows.map((row) => row.businessId);
  },
  listLogoutRequests: async () => {
    const rows = await prisma.whatsAppSession.findMany({
      where: { logoutRequestedAt: { not: null } },
      select: { businessId: true },
    });

    return rows.map((row) => row.businessId);
  },
  clearLogoutRequest: async (businessId: string) => {
    // updateMany: a row removed mid-flight must not make the sweep throw.
    await prisma.whatsAppSession.updateMany({
      where: { businessId },
      data: { logoutRequestedAt: null },
    });
  },
  connect: connectTenant,
});

/** `SIGINT`/`SIGTERM`: close every socket and let Prisma release its pool. */
async function shutdown(reason: string): Promise<void> {
  console.info(`[whatsapp-worker] ${reason} received, shutting down`);
  await worker.stop();
  await prisma.$disconnect();
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  if (once) {
    const started = await worker.poll({ includeConnected: true });
    console.info(
      `[whatsapp-worker] single sweep started ${started.length} session(s)`,
    );
    await worker.stop();
    await prisma.$disconnect();
    return;
  }

  const configured = Number(
    process.env.WHATSAPP_WORKER_POLL_MS ?? DEFAULT_POLL_MS,
  );
  const pollIntervalMs =
    Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_POLL_MS;

  await worker.start({ pollIntervalMs });
  console.info(
    `[whatsapp-worker] running; polling WhatsAppSession every ${pollIntervalMs}ms`,
  );

  let closing = false;
  const onSignal = (signal: string) => {
    if (closing) return;
    closing = true;

    void shutdown(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error("[whatsapp-worker] shutdown failed", error);
        process.exit(1);
      });
  };

  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));
}

// A worker must not die on one stray rejection (a provider probe, a storage
// upload): log it and keep the sockets alive.
process.on("unhandledRejection", (reason) => {
  console.error("[whatsapp-worker] unhandled rejection", reason);
});

void main().catch((error: unknown) => {
  console.error("[whatsapp-worker] fatal error", error);
  void prisma.$disconnect().finally(() => process.exit(1));
});

