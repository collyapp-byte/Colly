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
