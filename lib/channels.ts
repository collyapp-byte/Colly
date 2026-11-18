/**
 * The Channels hub: one vocabulary for WhatsApp, Telegram, Discord and Web Chat.
 *
 * Every channel used to live somewhere else — WhatsApp in its own sidebar row,
 * Telegram/Discord buried inside Settings → AI & Channels, Web Chat on a third
 * settings page. `/channels` puts the four cards side by side, so this module is
 * the single place that answers the questions a card asks:
 *
 *   - what is this channel called and what does one AI reply cost on it?
 *   - what does its live status badge say, and is that badge healthy?
 *   - what does the button under the card say?
 *
 * Deliberately dependency-free apart from `lib/plans` and `lib/whatsapp-pairing`
 * (both pure too), so the server page, the client cards and
 * `tests/channels.test.ts` can all import it without pulling Prisma or React
 * into the graph.
 */

import { REPLY_CREDIT_COSTS } from "./plans";
import { isPairingStalled } from "./whatsapp-pairing";

/** Where every channel is paired, connected and customized. */
export const CHANNELS_HUB_PATH = "/channels";

/** Query flag the hub uses to open a card straight away (`/channels?channel=telegram`). */
export const CHANNEL_QUERY_PARAM = "channel";

/** The four channels the hub manages, in card order (WhatsApp, Telegram, Discord, Web Chat). */
export const CHANNEL_KEYS = [
  "whatsapp",
  "telegram",
  "discord",
  "web_chat",
] as const;

export type ChannelKey = (typeof CHANNEL_KEYS)[number];

/** Narrows an untrusted value (a query param, a stored value) to a channel key. */
export function isChannelKey(value: unknown): value is ChannelKey {
  return (
    typeof value === "string" && (CHANNEL_KEYS as readonly string[]).includes(value)
  );
}

/**
 * One card's static copy. `ownerOnly` says who may change the connection — the
 * same rule `lib/team.ts` applies to settings pages and the mutation APIs apply
 * to themselves; the hub only uses it to render a card that is honest.
 */
export type ChannelDefinition = {
  key: ChannelKey;
  label: string;
  /** One line, shown under the title at rest. */
  description: string;
  /** Credits one AI reply spends on this channel. */
  creditCost: number;
  /** True when only the business owner may connect or disconnect it. */
  ownerOnly: boolean;
};

export const CHANNEL_DEFINITIONS: readonly ChannelDefinition[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    description: "Answer customers on the number they already message you on.",
    creditCost: REPLY_CREDIT_COSTS.whatsapp,
    ownerOnly: true,
  },
  {
    key: "telegram",
    label: "Telegram",
    description: "Your bot answers every message and copies you on handoffs.",
    creditCost: REPLY_CREDIT_COSTS.standard,
    ownerOnly: true,
  },
  {
    key: "discord",
    label: "Discord",
    description: "Answer members in your Discord server, 24/7.",
    creditCost: REPLY_CREDIT_COSTS.standard,
    ownerOnly: true,
  },
  {
    key: "web_chat",
    label: "Web Chat",
    description: "Drop the AI chat widget onto your website with one snippet.",
    creditCost: REPLY_CREDIT_COSTS.standard,
    ownerOnly: false,
  },
];

/** The definition for one channel. */
export function getChannelDefinition(key: ChannelKey): ChannelDefinition {
  const found = CHANNEL_DEFINITIONS.find((channel) => channel.key === key);
  if (!found) {
    // Only reachable if the key list and the definitions drift apart; fail loudly
    // in development instead of rendering a card with no price.
    throw new Error(`Unknown channel: ${key}`);
  }
  return found;
}

/** Credits one AI reply spends on this channel. */
export function channelCreditCost(key: ChannelKey): number {
  return getChannelDefinition(key).creditCost;
}

/** The pill a card carries: "80 credits / AI reply", "5 credits / AI reply". */
export function channelCreditLabel(key: ChannelKey): string {
  const cost = channelCreditCost(key);
  return `${cost} credit${cost === 1 ? "" : "s"} / AI reply`;
}

/**
 * The primary button under a card. Connected channels offer to be managed;
 * disconnected ones to be connected. Web Chat is always live, so it is
 * customized rather than connected.
 */
export function channelActionLabel(
  key: ChannelKey,
  connected: boolean,
): "Connect" | "Manage" | "Customize" {
  if (key === "web_chat") return "Customize";
  return connected ? "Manage" : "Connect";
}

/* ---------------------------------------------------------------------------
   WhatsApp pairing
--------------------------------------------------------------------------- */

/** `WhatsAppSession.status` as the hub reads it. */
export const WHATSAPP_SESSION_STATUSES = [
  "CONNECTED",
  "DISCONNECTED",
  "QR_READY",
  "CONNECTING",
] as const;

export type WhatsAppSessionStatus = (typeof WHATSAPP_SESSION_STATUSES)[number];

/** Narrows an untrusted value to a session status. */
export function isWhatsAppSessionStatus(
  value: unknown,
): value is WhatsAppSessionStatus {
  return (
    typeof value === "string" &&
    (WHATSAPP_SESSION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Everything a card and the pairing panel need from `WhatsAppSession`.
 *
 * `stalled` is decided by the server through `isPairingStalled()` — the browser
 * never runs that rule on its own clock (see lib/whatsapp-pairing.ts).
 */
export type WhatsAppSessionView = {
  status: WhatsAppSessionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  /** ISO stamp of the worker's last write (null when there is no row). */
  updatedAt: string | null;
  /** A CONNECTING row the worker never answered (45-second rule). */
  stalled: boolean;
};

/** The state of a tenant that never pressed Connect. */
export const DISCONNECTED_WHATSAPP_SESSION: WhatsAppSessionView = {
  status: "DISCONNECTED",
  qrCode: null,
  phoneNumber: null,
  updatedAt: null,
  stalled: false,
};

/**
 * Narrows a `GET /api/whatsapp/session` payload (or any hand-built object) into
 * a session view. An unknown status reads as DISCONNECTED: a card must never
 * claim a connection the API cannot confirm.
 */
export function normalizeWhatsAppSession(payload: unknown): WhatsAppSessionView {
  const data = (payload ?? {}) as Partial<WhatsAppSessionView>;

  return {
    status: isWhatsAppSessionStatus(data.status)
      ? data.status
      : DISCONNECTED_WHATSAPP_SESSION.status,
    qrCode: typeof data.qrCode === "string" ? data.qrCode : null,
    phoneNumber: typeof data.phoneNumber === "string" ? data.phoneNumber : null,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    stalled: data.stalled === true,
  };
}

/** The minimum a `WhatsAppSession` row must expose to become a view. */
export type WhatsAppSessionRowLike = {
  status: string;
  qrCode: string | null;
  phoneNumber: string | null;
  updatedAt: Date | null;
} | null;

/**
 * Builds the hub's view from the Prisma row (server side).
 *
 * `stalled` is recomputed here rather than read from anywhere, so the first
 * paint of `/channels` applies the same 45-second rule the polling route does.
 */
export function whatsappSessionViewFromRow(
  row: WhatsAppSessionRowLike,
  now: number = Date.now(),
): WhatsAppSessionView {
  if (!row) return DISCONNECTED_WHATSAPP_SESSION;

  const status = isWhatsAppSessionStatus(row.status)
    ? row.status
    : DISCONNECTED_WHATSAPP_SESSION.status;
  const updatedAt = row.updatedAt ? row.updatedAt.toISOString() : null;

  return {
    status,
    qrCode: row.qrCode,
    phoneNumber: row.phoneNumber,
    updatedAt,
    stalled: isPairingStalled({ status, qrCode: row.qrCode, updatedAt }, now),
  };
}

/** The badge text for a WhatsApp session: Connected, QR Ready, Starting, No response, Disconnected. */
export function whatsappStatusLabel(
  status: WhatsAppSessionStatus,
  stalled = false,
): "Connected" | "QR Ready" | "Starting" | "No response" | "Disconnected" {
  if (status === "CONNECTED") return "Connected";
  if (status === "QR_READY") return "QR Ready";
  // A CONNECTING row the worker never answered is not "starting" any more.
  if (status === "CONNECTING") return stalled ? "No response" : "Starting";
  return "Disconnected";
}

/** How a status badge should read at a glance. */
export type ChannelStatusTone = "positive" | "waiting" | "problem" | "neutral";

export function whatsappStatusTone(
  status: WhatsAppSessionStatus,
  stalled = false,
): ChannelStatusTone {
  if (status === "CONNECTED") return "positive";
  if (status === "QR_READY") return "waiting";
  if (status === "CONNECTING") return stalled ? "problem" : "waiting";
  return "neutral";
}

/**
 * `Connected` for a stored bot token, `Disconnected` otherwise. Both Telegram
 * and Discord are stored as a token on `Business`, so they share this rule.
 */
export function botChannelStatusLabel(
  connected: boolean,
): "Connected" | "Disconnected" {
  return connected ? "Connected" : "Disconnected";
}

/** Web Chat has no pair step: the widget is live as soon as the business exists. */
export const WEB_CHAT_STATUS_LABEL = "Active";

/** Telegram's public bot link, or null when no username is stored. */
export function telegramBotLink(username: string | null): string | null {
  if (!username) return null;
  return `https://t.me/${username.replace(/^@/, "")}`;
}
