// Paystack client: transaction checkout, verification, customers,
// subscriptions (pause/resume) and webhook signature validation.
//
// Only the functions Colly needs today are exposed. All amounts going to
// Paystack are in kobo (naira * 100); the Transaction table stores Naira.
//
// The wrapper reads PAYSTACK_SECRET_KEY lazily at call time so unset env vars
// are an error per request, not at import time.

import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

/** The standard Paystack response envelope. */
type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  return key;
}

/** A single Paystack API call, throwing a readable error on any non-2xx. */
async function paystackFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as Partial<
    PaystackResponse<unknown>
  >;

  if (!res.ok) {
    const message =
      typeof body.message === "string"
        ? body.message
        : `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`Paystack ${init.method ?? "GET"} ${path} failed: ${message}`);
  }

  return (body.data ?? (body as T)) as T;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InitializeTransactionInput = {
  email: string;
  amountKobo: number;
  /** Plan code from `getPaystackPlanCode`; makes it a subscription checkout. */
  planCode?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export type InitializeTransactionData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type VerifyTransactionData = {
  status: string; // "success" | "abandoned" | "failed" | ...
  reference: string;
  amount: number; // kobo
  currency: string;
  channel?: string;
  paid_at?: string;
  metadata?: Record<string, unknown> | null;
  customer?: {
    id: number;
    customer_code: string;
    email: string;
  };
  plan?: {
    plan_code: string;
    interval: string;
    name: string;
  } | null;
};

export type SubscriptionData = {
  status: string; // "active" | "cancelled" | "paused" | "sending" | ...
  subscription_code: string;
  email_token: string;
  customer?: { customer_code: string; email: string };
  plan?: { plan_code: string; interval: string; name: string };
  created_at?: string;
  next_payment_date?: string | null;
  amount?: number;
};

export type SubscriptionResponseData = {
  status: string;
  message: string;
} & Record<string, unknown>;

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * Start a Paystack checkout. With a `planCode` this initializes a recurring
 * subscription; without one it is a one-off payment (used for credit top-ups).
 */
export async function initializeTransaction({
  email,
  amountKobo,
  planCode,
  callbackUrl,
  metadata,
}: InitializeTransactionInput): Promise<InitializeTransactionData> {
  const body: Record<string, unknown> = {
    email,
    amount: amountKobo,
  };

  if (planCode) {
    body.plan = planCode;
  }
  if (callbackUrl) {
    body.callback_url = callbackUrl;
  }
  if (metadata) {
    body.metadata = metadata;
  }

  return paystackFetch<InitializeTransactionData>(
    "/transaction/initialize",
    { method: "POST", body: JSON.stringify(body) },
  );
}

/** Fetch the details of a past transaction to confirm payment. */
export async function verifyTransaction(
  reference: string,
): Promise<VerifyTransactionData> {
  return paystackFetch<VerifyTransactionData>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/** Read a subscription's current status. */
export async function fetchSubscription(
  subscriptionCode: string,
): Promise<SubscriptionData> {
  return paystackFetch<SubscriptionData>(
    `/subscription/${encodeURIComponent(subscriptionCode)}`,
    { method: "GET" },
  );
}

/** Pause a subscription. `emailToken` comes from the stored `paystackEmailToken`. */
export async function disableSubscription({
  subscriptionCode,
  emailToken,
}: {
  subscriptionCode: string;
  emailToken: string;
}): Promise<SubscriptionResponseData> {
  return paystackFetch<SubscriptionResponseData>(
    `/subscription/${encodeURIComponent(subscriptionCode)}/disable`,
    {
      method: "POST",
      body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
    },
  );
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export type TransferRecipientData = {
  recipient_code: string;
  type: string;
  name: string;
  details: {
    account_number: string;
    account_name: string;
    bank_code: string;
    bank_name: string;
  };
};

export type TransferData = {
  reference: string;
  status: string;
  amount: number;
  recipient: { recipient_code: string };
};

export type PaystackBank = {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode: string;
  gateway: string | null;
  pay_with_bank: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  is_deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * List Nigerian banks supported for transfers.
 */
export async function listBanks(): Promise<PaystackBank[]> {
  return paystackFetch<PaystackBank[]>("/bank?currency=NGN", { method: "GET" });
}

/**
 * Create a transfer recipient (NUBAN) so funds can be sent to an agent's bank account.
 */
export async function createTransferRecipient({
  name,
  accountNumber,
  bankCode,
}: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<TransferRecipientData> {
  return paystackFetch<TransferRecipientData>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    }),
  });
}

/**
 * Initiate a transfer from the Paystack balance to a recipient.
 * Amount must be passed in kobo; we store amounts in Naira.
 */
export async function initiateTransfer({
  amountKobo,
  recipient,
  reason,
  reference,
}: {
  amountKobo: number;
  recipient: string;
  reason?: string;
  reference: string;
}): Promise<TransferData> {
  return paystackFetch<TransferData>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: amountKobo,
      recipient,
      reason: reason ?? "Colly Agent Commission",
      reference,
    }),
  });
}

/**
 * Verify a Paystack webhook signature. Paystack signs the raw request body
 * with an HMAC-SHA512 of the secret key, sent as `x-paystack-signature` in the
 * form `sha512=<hex>`.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const expected = `sha512=${createHmac("sha512", getSecretKey())
    .update(rawBody)
    .digest("hex")}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signature ?? "");

  return a.length === b.length && timingSafeEqual(a, b);
}
