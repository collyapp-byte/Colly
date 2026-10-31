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
export const CHANNELS = ["TELEGRAM", "DISCORD"] as const;

export type Channel = (typeof CHANNELS)[number];

/** Narrows an unknown value (e.g. a form field) to a valid Channel. */
export function isChannel(value: unknown): value is Channel {
  return (
    typeof value === "string" && (CHANNELS as readonly string[]).includes(value)
  );
}

/**
 * The verticals a business can sell in.
 *
 * `Business.industry` is stored as one of these strings. It is not cosmetic: the
 * AI persona depends on it — `buildSystemPrompt()` in lib/chat-engine.ts
 * appends the hotel-receptionist block for "HOTEL" — so a stored value this
 * list does not know is read as "RETAIL" (the schema default) rather than
 * silently switching on a persona nobody validated.
 */
export const INDUSTRIES = ["RETAIL", "HOTEL", "SERVICES"] as const;

export type Industry = (typeof INDUSTRIES)[number];

/** The industry every business starts on (schema default). */
export const DEFAULT_INDUSTRY: Industry = "RETAIL";

/** Narrows an unknown value (e.g. a PATCH body field) to a valid Industry. */
export function isIndustry(value: unknown): value is Industry {
  return (
    typeof value === "string" && (INDUSTRIES as readonly string[]).includes(value)
  );
}

/** Display names for the Settings dropdown and the marketing copy. */
export const INDUSTRY_LABELS: Record<Industry, string> = {
  RETAIL: "Retail",
  HOTEL: "Hotel",
  SERVICES: "Services",
};

/**
 * Reads an industry out of a URL slug (`/signup?industry=hotel`).
 *
 * The signup links spell the industry in lower case, so "hotel" and "HOTEL"
 * both mean the same vertical; an unknown or missing slug returns null and the
 * Business row keeps its schema default. "service" is accepted as a sibling of
 * "services" because it is the spelling a person types.
 */
export function industryFromSlug(value: unknown): Industry | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "SERVICE") {
    return "SERVICES";
  }

  return isIndustry(normalized) ? normalized : null;
}

/** The industry slug a signup link carries: `/signup?role=business&industry=hotel`. */
export function industrySlug(industry: Industry): string {
  return industry.toLowerCase();
}

  /** Channel connection states, matching `Business.connectionStatus`. */
export const CONNECTION_STATUSES = [
  "DISCONNECTED",
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
  /** The vertical this business sells in — selects the AI persona. */
  industry: Industry;
  businessHours: string | null;
  address: string | null;
  description: string | null;
  /** Bank/transfer instructions the AI can share with customers. */
  paymentInstructions: string | null;
  /** Two-Number Model: false until the dedicated AI line is provisioned. */
  aiLineConnected: boolean;
  /** Messaging channel this business runs on: "TELEGRAM" | "DISCORD". */
  channel: Channel;
  /** Channel connection state: "DISCONNECTED" | "CONNECTED". Drives the AI
   * Line settings page. */
  connectionStatus: ConnectionStatus;
  /** Telegram bot handle (no "@") from getMe; renders the owner's shareable
   * t.me link once the bot is connected. */
  telegramBotUsername: string | null;
  /** Whether a Telegram bot token is stored for this business. */
  telegramConnected: boolean;
  /** Whether a Discord bot token is stored for this business. */
  discordConnected: boolean;
  /** Discord server ("guild") id the bot answers in. */
  discordGuildId?: string | null;
  /** The OWNER'S personal Telegram chat id (from @userinfobot) — where
   * escalation alerts go. null means owner alerts are not connected yet. */
  ownerTelegramChatId: string | null;
  /** Agent ("AG-0001") that set the business up, if any — drives the
   * "your agent will set this up" note on the AI line page. */
  referredByAgentId: string | null;
  /** The plan tier the customer picked before signing up ("?plan=green").
   * Pre-selects that tier on the plans page. */
  selectedPlan: string | null;
  planStatus: string;
  paymentFailedAt: string | null;
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
  industry: string;
  businessHours: string | null;
  address: string | null;
  description: string | null;
  paymentInstructions: string | null;
  aiLineConnected: boolean;
  channel: string;
  connectionStatus: string;
  telegramBotUsername: string | null;
  telegramBotToken?: string | null;
  discordBotToken?: string | null;
  discordGuildId?: string | null;
  ownerTelegramChatId: string | null;
  referredByAgentId: string | null;
  selectedPlan: string | null;
  planStatus: string;
  paymentFailedAt: Date | null;
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
    // An unknown stored industry falls back to the schema default rather than
    // enabling a persona the list does not know about.
    industry: isIndustry(business.industry)
      ? business.industry
      : DEFAULT_INDUSTRY,
    businessHours: business.businessHours,
    address: business.address,
    description: business.description,
    paymentInstructions: business.paymentInstructions,
    aiLineConnected: business.aiLineConnected,
    // Unknown stored values fall back to the defaults used at signup so the
    // client always gets a valid option back.
    channel: isChannel(business.channel) ? business.channel : "TELEGRAM",
    connectionStatus: isConnectionStatus(business.connectionStatus)
      ? business.connectionStatus
      : "DISCONNECTED",
    telegramBotUsername: business.telegramBotUsername,
    telegramConnected: Boolean(business.telegramBotToken),
    discordConnected: Boolean(business.discordBotToken),
    discordGuildId: business.discordGuildId ?? null,
    ownerTelegramChatId: business.ownerTelegramChatId,
    referredByAgentId: business.referredByAgentId,
    selectedPlan: business.selectedPlan ?? null,
    planStatus: business.planStatus,
    paymentFailedAt: business.paymentFailedAt
      ? new Date(business.paymentFailedAt).toISOString()
      : null,
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
