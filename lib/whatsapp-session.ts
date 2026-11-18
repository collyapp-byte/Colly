/**
 * WhatsApp inbound adapter (Baileys-shaped).
 *
 * WHY THIS FILE DOES NOT IMPORT BAILEYS
 * `@whiskeysockets/baileys` is not a dependency of this app, and it cannot be
 * driven from a Next.js request handler: a WhatsApp socket is a long-lived,
 * stateful connection that owns its own auth session, QR pairing and reconnect
 * loop, while app routes are short-lived request scopes. The socket belongs in a
 * worker process. This module is therefore transport-agnostic — it accepts
 * anything shaped like `makeWASocket()`, which is `sendMessage(jid, { text })`
 * plus an optional `ev.on` — and a worker only has to do:
 *
 *   attachWhatsAppListener({ sock, businessId });
 *
 * WHAT A MESSAGE TURN DOES
 * 1. `handleIncomingMessage()` stores the customer's message.
 * 2. It waits `getRandomDelay()` (opt-in `typingJitter`) so the answer lands
 *    after a human-looking pause instead of instantly.
 * 3. It generates the reply and stores it as `Message.sender = "ai"`.
 * 4. The adapter sends that text on the socket.
 *
 * The engine is not bypassed on purpose. It is where credits are charged, a
 * human takeover is honoured and the catalogue/booking tools run; a hand-rolled
 * `generateAiReply` + `sendMessage` loop would give every WhatsApp customer
 * free, tool-less replies.
 *
 * NAMING: there is no `senderType` column and no "BOT" value. `Message.sender`
 * holds "customer", "ai" (Colly) or "agent" (a human), so an outbound bot reply
 * is `sender: "ai"` — written by the engine, not by this module.
 */

import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/chat-engine";
import { debugLog } from "@/lib/logger";
import { isPairingStalled } from "@/lib/whatsapp-pairing";

/** The slice of a Baileys `WAMessage` this adapter reads. */
export type WhatsAppInboundMessage = {
  key?: {
    remoteJid?: string | null;
    fromMe?: boolean | null;
    id?: string | null;
  } | null;
  message?: {
    conversation?: string | null;
    extendedTextMessage?: { text?: string | null } | null;
    imageMessage?: { caption?: string | null } | null;
  } | null;
};

/** The payload of Baileys' `messages.upsert` event. */
export type WhatsAppUpsert = {
  /** "notify" for a new message; "append" for history sync. */
  type?: string | null;
  messages?: WhatsAppInboundMessage[] | null;
};

/** The payload of Baileys' `connection.update` event. */
export type WhatsAppConnectionUpdate = {
  connection?: "open" | "connecting" | "close" | string | null;
  qr?: string | null;
  lastDisconnect?: { error?: unknown } | null;
};

export type WhatsAppSocket = {
  /**
   * `sock.ev` from Baileys. Optional: a test double or a one-way sender only
   * needs `sendMessage`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Baileys' event map is a third-party generic; mirroring it here would force every worker to cast its socket.
  ev?: { on: (event: any, handler: any) => unknown };
  /** `sock.sendMessage(jid, { text })`. */
  sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
};

/** The status values stored on `WhatsAppSession.status`. */
export type WhatsAppSessionState =
  | "CONNECTED"
  | "DISCONNECTED"
  | "QR_READY"
  | "CONNECTING";

/** Narrows a stored/typed value to a session status. */
export function isWhatsAppSessionState(
  value: unknown,
): value is WhatsAppSessionState {
  return (
    value === "CONNECTED" ||
    value === "DISCONNECTED" ||
    value === "QR_READY" ||
    value === "CONNECTING"
  );
}

/**
 * The tenant an API call may act on.
 *
 * The session is the source of truth. A `businessId` from a body or query is
 * only allowed to repeat it — anything else is a cross-tenant attempt and must
 * be refused (`null`), never silently redirected to the caller's own business.
 * A missing or non-string value simply means "my own business".
 */
export function resolveWhatsAppBusinessId(
  userBusinessId: string,
  requested: unknown,
): string | null {
  const value = typeof requested === "string" ? requested.trim() : "";
  if (!value) return userBusinessId;

  return value === userBusinessId ? userBusinessId : null;
}

/** One row as the dashboard's connect screen reads it. */
export type WhatsAppSessionView = {
  status: WhatsAppSessionState;
  qrCode: string | null;
  phoneNumber: string | null;
};

/**
 * The polling payload: the view plus the pairing clock.
 *
 * `stalled` is computed server-side because the browser's clock is not the
 * database's; the page only decides how to render it.
 */
export type WhatsAppSessionSnapshot = WhatsAppSessionView & {
  /** ISO stamp of the worker's last write; null when no row exists. */
  updatedAt: string | null;
  /** A CONNECTING row with no QR whose worker has been silent too long. */
  stalled: boolean;
};

/**
 * The API payload for one session row.
 *
 * A missing row (a tenant that never pressed Connect) reads as DISCONNECTED
 * with nothing to show, so the client has no special case for a first visit.
 * An unknown stored status is also read as DISCONNECTED rather than trusted
 * into the UI.
 */
export function serializeWhatsAppSession(
  row: {
    status: string;
    qrCode: string | null;
    phoneNumber: string | null;
  } | null,
): WhatsAppSessionView {
  return {
    status:
      row && isWhatsAppSessionState(row.status) ? row.status : "DISCONNECTED",
    qrCode: row?.qrCode ?? null,
    phoneNumber: row?.phoneNumber ?? null,
  };
}

/**
 * The row plus its pairing clock, as `GET /api/whatsapp/session` answers it.
 *
 * `updatedAt` is the worker's last write. It is what lets the dashboard tell a
 * pairing that is still starting from one whose worker never arrived: a
 * CONNECTING row that has not been touched for `PAIRING_TIMEOUT_MS` is
 * `stalled`, and the page offers Retry instead of an endless spinner.
 */
export function serializeWhatsAppSessionSnapshot(
  row: {
    status: string;
    qrCode: string | null;
    phoneNumber: string | null;
    updatedAt: Date | null;
  } | null,
  now: number = Date.now(),
): WhatsAppSessionSnapshot {
  const view = serializeWhatsAppSession(row);
  const updatedAt = row?.updatedAt ? row.updatedAt.toISOString() : null;

  return {
    ...view,
    updatedAt,
    stalled: isPairingStalled({ ...view, updatedAt }, now),
  };
}

/**
 * True for a JID that is not a one-to-one customer chat: a group
 * (`…@g.us`), the status feed (`status@broadcast`), a broadcast list
 * (`…@broadcast`) or a newsletter (`…@newsletter`). The AI never answers
 * inside those — a group reply would speak to strangers and a status reply is
 * not a conversation at all.
 */
export function isGroupOrBroadcastJid(jid: string): boolean {
  return (
    jid.endsWith("@g.us") ||
    jid.endsWith("@broadcast") ||
    jid.endsWith("@newsletter") ||
    jid === "status@broadcast"
  );
}

/**
 * The digits a customer is keyed by in the database.
 *
 * Baileys uses `2348012345678@s.whatsapp.net`, and a device JID adds
 * `:12@…`; the tenant's `Customer.phone` uses the bare number, which is what
 * `businessId_phone` unique is built on.
 */
export function whatsappPhoneFromJid(jid: string): string {
  return (jid.split("@")[0] ?? "").split(":")[0]?.trim() ?? "";
}

/**
 * The text of an inbound message, or "" when there is nothing the AI can read.
 *
 * Captions ride along with images. A voice note or an uncaptioned picture is
 * deliberately skipped here: transcription and the receipt pipeline need the
 * Supabase Storage upload that only the Telegram/web pipelines do, so silently
 * passing a placeholder to the model would invent an answer.
 */
export function extractWhatsAppText(
  message: WhatsAppInboundMessage["message"],
): string {
  if (!message) return "";

  const text =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    "";

  return typeof text === "string" ? text.trim() : "";
}

/** Produces the reply text for one customer message (null = stay silent). */
export type WhatsAppReplyFn = (input: {
  businessId: string;
  customerPhone: string;
  text: string;
}) => Promise<string | null>;

/**
 * The default reply source: the real engine, human-typing jitter included.
 * Credits, pauses, escalation and tools all behave exactly as they do on
 * Telegram and the web widget.
 */
export const replyWithEngine: WhatsAppReplyFn = async ({
  businessId,
  customerPhone,
  text,
}) => {
  const result = await handleIncomingMessage({
    businessId,
    customerPhone,
    message: text,
    typingJitter: true,
    // Price the turn as WhatsApp (80 credits), whatever the tenant's default
    // `Business.channel` is. Without this a WhatsApp reply on a Telegram-plan
    // account would be gated and charged at the 5-credit standard rate.
    channel: "WHATSAPP",
  });

  return result.reply;
};

/**
 * Reply to one customer and deliver it.
 *
 * `jid` is what `sock.sendMessage()` takes (`2348…@s.whatsapp.net`); the digits
 * alone are not a valid JID. The database key is derived from the same JID, so
 * the two can never disagree.
 *
 * Returns the delivered text, or `null` when the engine chose silence (paused
 * conversation, no credits, `[SILENCE]`, provider outage).
 */
export async function replyToWhatsAppCustomer({
  sock,
  businessId,
  jid,
  text,
  reply = replyWithEngine,
}: {
  sock: WhatsAppSocket;
  businessId: string;
  /** `key.remoteJid` from Baileys. */
  jid: string;
  text: string;
  /** Injected in tests; production uses `replyWithEngine`. */
  reply?: WhatsAppReplyFn;
}): Promise<string | null> {
  const customerPhone = whatsappPhoneFromJid(jid);
  if (!customerPhone) return null;

  const aiResponse = await reply({ businessId, customerPhone, text });
  if (!aiResponse) return null;

  await sock.sendMessage(jid, { text: aiResponse });

  return aiResponse;
}

/**
 * The `messages.upsert` body.
 *
 * Everything not addressed to the AI is skipped before a database read: our own
 * messages (`fromMe`), groups/broadcasts/status, and messages with no readable
 * text. One failing message never aborts the rest of the batch — a WhatsApp
 * outage or a bad row must not silence the next customer.
 */
export async function handleWhatsAppUpsert({
  sock,
  businessId,
  update,
  reply = replyWithEngine,
}: {
  sock: WhatsAppSocket;
  businessId: string;
  update: WhatsAppUpsert;
  reply?: WhatsAppReplyFn;
}): Promise<void> {
  for (const incoming of update.messages ?? []) {
    const jid = incoming.key?.remoteJid?.trim();
    if (!jid) continue;
    if (incoming.key?.fromMe) continue;
    if (isGroupOrBroadcastJid(jid)) continue;

    const text = extractWhatsAppText(incoming.message);
    if (!text) continue;

    try {
      await replyToWhatsAppCustomer({ sock, businessId, jid, text, reply });
    } catch (error) {
      console.error(
        `[whatsapp] reply failed for business ${businessId}`,
        error,
      );
    }
  }
}


/**
 * Records the socket's state on `WhatsAppSession` so the dashboard (and an
 * operator) can see whether the line is live, waiting for a QR scan or down.
 * Best effort: a missing table or a write failure is logged, never thrown into
 * the socket's event loop.
 */
export async function setWhatsAppSessionStatus(
  businessId: string,
  status: WhatsAppSessionState,
  extra: { qrCode?: string | null; phoneNumber?: string | null } = {},
): Promise<void> {
  try {
    await prisma.whatsAppSession.upsert({
      where: { businessId },
      update: { status, ...extra },
      create: { businessId, status, ...extra },
    });
  } catch (error) {
    console.error(
      `[whatsapp] could not record session state for business ${businessId}`,
      error,
    );
  }
}

/** Maps a Baileys `connection.update` payload onto the stored session status. */
async function recordConnectionUpdate(
  businessId: string,
  update: WhatsAppConnectionUpdate,
): Promise<void> {
  if (!update) return;

  if (update.qr) {
    await setWhatsAppSessionStatus(businessId, "QR_READY", {
      qrCode: update.qr,
    });
    return;
  }

  if (update.connection === "open") {
    await setWhatsAppSessionStatus(businessId, "CONNECTED", { qrCode: null });
    return;
  }

  if (update.connection === "connecting") {
    await setWhatsAppSessionStatus(businessId, "CONNECTING");
    return;
  }

  if (update.connection === "close") {
    debugLog("[whatsapp] socket closed", update.lastDisconnect?.error);
    await setWhatsAppSessionStatus(businessId, "DISCONNECTED", {
      qrCode: null,
    });
  }
}

/**
 * Subscribe one socket to its business. Call it once, right after
 * `makeWASocket()`; one socket serves one tenant, so `businessId` is fixed
 * here rather than looked up per message.
 *
 * `connectionState` defaults to true, which is all a library-only caller needs.
 * Set it to false in the long-lived worker (`workers/whatsapp-worker.ts`): that
 * process owns pairing (QR), the connected phone number and reconnect/backoff,
 * so it must be the single writer of the session row — two handlers would race
 * on `status`/`qrCode` and the worker's copy would win only sometimes.
 */
export function attachWhatsAppListener({
  sock,
  businessId,
  connectionState = true,
}: {
  sock: WhatsAppSocket;
  businessId: string;
  /** Subscribe `connection.update` (status + QR) as well. */
  connectionState?: boolean;
}): void {
  sock.ev?.on("messages.upsert", (update: WhatsAppUpsert) => {
    // `notify` is a new message; `append` is history sync, which must not
    // trigger a burst of replies to months-old chats.
    if (update?.type && update.type !== "notify") return;

    void handleWhatsAppUpsert({ sock, businessId, update });
  });

  if (!connectionState) return;

  sock.ev?.on("connection.update", (update: WhatsAppConnectionUpdate) => {
    void recordConnectionUpdate(businessId, update);
  });
}

