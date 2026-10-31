// Vision service using Groq's vision model for image description and receipt
// reading.
//
// POSTs to the OpenAI-compatible chat completions endpoint with a system prompt
// (product identifier for Nigerian retail) and a user message that includes both
// a text instruction and the image URL. Returns a short description and a flag
// indicating whether the image is a product or not.
//
// The same endpoint answers a second question about the same picture: when the
// image is clearly not a product it may be a payment receipt, and
// `readReceipt()` asks the model for the amount, sender, date and reference so
// the chat engine can turn it into a draft invoice.

const GROQ_VISION_URL = "https://api.groq.com/openai/v1/chat/completions";

const GROQ_VISION_MODEL = "qwen/qwen3.8-27b";

const SYSTEM_PROMPT =
  "You are a visual product identifier for a Nigerian retail shop. Describe what is in the image in one short sentence. Focus on: product type, colour, approximate size if obvious, and distinctive features. Do NOT invent specs. If the image is clearly not a product (e.g. a selfie, a document, a logo), reply with exactly: 'Not a product image.' Otherwise reply with just the description, under 25 words, plain text only, no markdown, no asterisks, no bullet points.";

type GroqChatCompletion = {
  choices: Array<{
    message: {
      content?: string | null;
    };
  }>;
};

type DescribeImageResponse = {
  description: string;
  isProduct: boolean;
};

/**
 * What `readReceipt()` extracts from a payment screenshot.
 *
 * `amountKobo` is an integer: money in this codebase is computed in kobo, never
 * in floating-point Naira, so the amount can be persisted and alerted on without
 * a rounding drift. It is null when the model could not read a total.
 */
export type ReceiptExtraction = {
  isReceipt: boolean;
  amountKobo: number | null;
  senderName: string | null;
  paidOn: string | null;
  reference: string | null;
};

const EMPTY_EXTRACTION: ReceiptExtraction = {
  isReceipt: false,
  amountKobo: null,
  senderName: null,
  paidOn: null,
  reference: null,
};

/** Longest free-text value we keep from the model (names, references, dates). */
const MAX_EXTRACTED_TEXT = 120;

/**
 * Receipt reader prompt. It is deliberately blunt about never guessing an
 * amount: the number becomes an invoice total the owner is asked to approve.
 */
const RECEIPT_PROMPT =
  "You read screenshots of payment receipts (bank transfer alerts, OPay, " +
  "Moniepoint, PalmPay, Kuda, Paystack, USSD confirmations) for a Nigerian " +
  "small business. Reply with JSON only, no markdown, no commentary, in exactly " +
  'this shape: {"isReceipt": boolean, "amount": number|null, ' +
  '"senderName": string|null, "date": string|null, "reference": string|null}. ' +
  '"isReceipt" is true only when the picture is a payment confirmation showing ' +
  'money that was actually sent. "amount" is the total paid in Naira, digits ' +
  "and a decimal point only (for example 25000.50): no currency symbol, no " +
  'thousands separators. "senderName" is the name of the person who paid. ' +
  '"date" is the payment date as YYYY-MM-DD when readable. "reference" is the ' +
  "transaction reference or session id when readable. Use null for anything " +
  "you cannot read. Never guess an amount.";

/**
 * Sends an image and a system prompt to Groq's vision model and returns the
 * assistant text.
 *
 * Throws a descriptive error when the API key is missing, Groq rejects the
 * request, or the response is not usable.
 */
async function callVision(args: {
  systemPrompt: string;
  userText: string;
  imageUrl: string;
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to your .env file to enable image recognition.",
    );
  }

  const body = {
    model: GROQ_VISION_MODEL,
    messages: [
      { role: "system" as const, content: args.systemPrompt },
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: args.userText },
          { type: "image_url" as const, image_url: { url: args.imageUrl } },
        ],
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch(GROQ_VISION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Could not reach Groq for image description: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Groq image description failed (${response.status} ${response.statusText})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }

  const data = (await response.json()) as GroqChatCompletion;
  const content = data.choices[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Groq returned an empty description.");
  }

  return content.trim();
}

/**
 * Sends an image to Groq's vision model and returns a short description.
 *
 * Throws a descriptive error when the API key is missing, the download of the
 * image fails, Groq rejects the request, or the response is not usable.
 */
export async function describeImage(
  imageUrl: string,
): Promise<DescribeImageResponse> {
  const content = await callVision({
    systemPrompt: SYSTEM_PROMPT,
    userText: "Describe this image.",
    imageUrl,
  });

  const isProduct = !content.startsWith("Not a product image");

  return { description: content, isProduct };
}

/** Keeps a model-provided string, trimmed and capped, or null when empty. */
function readExtractedText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().replace(/\s+/g, " ").slice(0, MAX_EXTRACTED_TEXT);

  return text.length > 0 ? text : null;
}

/**
 * Turns a model amount into integer kobo. Accepts a JSON number, or a string
 * such as "₦25,000.50" that slipped past the prompt, and returns null unless
 * the result is a positive, finite amount.
 */
function readExtractedKobo(value: unknown): number | null {
  let amount: number;

  if (typeof value === "number") {
    amount = value;
  } else if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (cleaned.length === 0) {
      return null;
    }
    amount = Number(cleaned);
  } else {
    return null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

/** Parses the model's JSON reply, tolerating code fences or stray prose. */
function parseReceiptExtraction(raw: string): ReceiptExtraction {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return EMPTY_EXTRACTION;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return EMPTY_EXTRACTION;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return EMPTY_EXTRACTION;
  }

  const record = parsed as Record<string, unknown>;

  return {
    isReceipt: record.isReceipt === true,
    amountKobo: readExtractedKobo(record.amount),
    senderName: readExtractedText(record.senderName),
    paidOn: readExtractedText(record.date),
    reference: readExtractedText(record.reference),
  };
}

/**
 * Asks the vision model whether a picture is a payment receipt and, when it is,
 * extracts the amount (integer kobo), the sender's name, the payment date and
 * the transaction reference.
 *
 * A picture that is not a receipt comes back as `isReceipt: false`; only a
 * network or API failure throws, so the caller can fall back to the plain image
 * description.
 */
export async function readReceipt(
  imageUrl: string,
): Promise<ReceiptExtraction> {
  const content = await callVision({
    systemPrompt: RECEIPT_PROMPT,
    userText: "Read this picture and reply with the JSON object.",
    imageUrl,
  });

  return parseReceiptExtraction(content);
}
