// Shared types and helpers for a business profile (Settings page + API).

/** The AI writing tones a business can choose between. */
export const TONES = ["formal", "friendly"] as const;

export type Tone = (typeof TONES)[number];

/** Narrows an unknown value (e.g. a JSON body field) to a valid Tone. */
export function isTone(value: unknown): value is Tone {
  return (
    typeof value === "string" && (TONES as readonly string[]).includes(value)
  );
}

/** The messaging channels a business can run on. */
export const CHANNELS = ["WHATSAPP", "TELEGRAM"] as const;

export type Channel = (typeof CHANNELS)[number];

/** Narrows an unknown value (e.g. a form field) to a valid Channel. */
export function isChannel(value: unknown): value is Channel {
  return (
    typeof value === "string" && (CHANNELS as readonly string[]).includes(value)
  );
}

/** Channel connection states, matching `Business.connectionStatus`. */
export const CONNECTION_STATUSES = [
  "DISCONNECTED",
  "PENDING_BSP_SETUP",
  "CONNECTED",
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Narrows an unknown value to a valid ConnectionStatus. */
export function isConnectionStatus(value: unknown): value is ConnectionStatus {
  return (
    typeof value === "string" &&
    (CONNECTION_STATUSES as readonly string[]).includes(value)
  );
}

/** A business profile as sent to / received from the API. */
export type Business = {
  id: string;
  name: string;
  phone: string;
  whatsappNumber: string;
  tone: Tone;
  businessHours: string | null;
  address: string | null;
  description: string | null;
  /** Two-Number Model: false until the dedicated AI line is provisioned. */
  aiLineConnected: boolean;
  /** Messaging channel this business runs on: "WHATSAPP" | "TELEGRAM". */
  channel: Channel;
  /** Channel connection state: "DISCONNECTED" | "PENDING_BSP_SETUP" |
   * "CONNECTED". Drives the AI Line settings page. */
  connectionStatus: ConnectionStatus;
  /** Telegram bot handle (no "@") from getMe; renders the owner's shareable
   * t.me link once the bot is connected. */
  telegramBotUsername: string | null;
  /** Telegram bot token (private). Present on the API response only when
   * returned by the server; the client type is still fine. */
  telegramBotToken?: string | null;
  /** The OWNER'S personal Telegram chat id (from @userinfobot) — where
   * escalation alerts go. null means owner alerts are not connected yet. */
  ownerTelegramChatId: string | null;
  /** Agent ("AG-0001") that set the business up, if any — drives the
   * "your agent will set this up" note on the AI line page. */
  referredByAgentId: string | null;
  createdAt: string;
  nrsTaxId: string | null;
  nrsRegistrationDate: string | null;
  nrsTier: string | null;
  nrsExemptReason: string | null;
  nrsLastDismissedAt: string | null;
};

/** Shape of a Business row as returned by Prisma. */
export type BusinessRecord = {
  id: string;
  name: string;
  phone: string;
  whatsappNumber: string;
  tone: string;
  businessHours: string | null;
  address: string | null;
  description: string | null;
  aiLineConnected: boolean;
  channel: string;
  connectionStatus: string;
  telegramBotUsername: string | null;
  telegramBotToken?: string | null;
  ownerTelegramChatId: string | null;
  referredByAgentId: string | null;
  createdAt: Date;
  nrsTaxId: string | null;
  nrsRegistrationDate: Date | null;
  nrsTier: string | null;
  nrsExemptReason: string | null;
  nrsLastDismissedAt: Date | null;
};

/**
 * Converts a Prisma Business row into the JSON-friendly `Business` shape.
 * An unknown stored tone falls back to "friendly" so the client always gets a
 * valid option back.
 */
export function serializeBusiness(business: BusinessRecord): Business {
  return {
    id: business.id,
    name: business.name,
    phone: business.phone,
    whatsappNumber: business.whatsappNumber,
    tone: isTone(business.tone) ? business.tone : "friendly",
    businessHours: business.businessHours,
    address: business.address,
    description: business.description,
    aiLineConnected: business.aiLineConnected,
    // Unknown stored values fall back to the defaults used at signup so the
    // client always gets a valid option back.
    channel: isChannel(business.channel) ? business.channel : "WHATSAPP",
    connectionStatus: isConnectionStatus(business.connectionStatus)
      ? business.connectionStatus
      : "DISCONNECTED",
    telegramBotUsername: business.telegramBotUsername,
    telegramBotToken: (business as any).telegramBotToken ?? null,
    ownerTelegramChatId: business.ownerTelegramChatId,
    referredByAgentId: business.referredByAgentId,
    createdAt: new Date(business.createdAt).toISOString(),
    nrsTaxId: business.nrsTaxId,
    nrsRegistrationDate: business.nrsRegistrationDate
      ? new Date(business.nrsRegistrationDate).toISOString()
      : null,
    nrsTier: business.nrsTier,
    nrsExemptReason: business.nrsExemptReason,
    nrsLastDismissedAt: business.nrsLastDismissedAt
      ? new Date(business.nrsLastDismissedAt).toISOString()
      : null,
  };
}
