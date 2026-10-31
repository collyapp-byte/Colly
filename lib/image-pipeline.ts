import { prisma } from "@/lib/prisma";
import {
  describeImage,
  readReceipt,
  type ReceiptExtraction,
} from "@/lib/vision";
import { formatNaira } from "@/lib/format";

export type ProcessedImageMessage = {
  messageId: string;
  description: string;
  isProduct: boolean;
  conversationId: string;
  /** Set when the picture was read as a payment receipt. */
  receipt: ReceiptExtraction | null;
};

/**
 * The prefix the chat engine keys on to know a receipt has already been read.
 * It matches the `[Customer sent a voice note]:` convention in lib/voice-pipeline.ts.
 */
const RECEIPT_PREFIX = "[Customer sent a payment receipt]";

/** Telegram captions are ≤1024 characters; anything longer is truncated. */
const MAX_CAPTION_LENGTH = 500;

/**
 * Turns the extracted receipt into the customer message the AI sees. The
 * amount is formatted from integer kobo for display only; the raw kobo value
 * stays in `ReceiptExtraction` for the invoice tool.
 */
function receiptSummary(receipt: ReceiptExtraction): string {
  const parts: string[] = [];

  if (receipt.amountKobo !== null) {
    parts.push(`Amount: ${formatNaira(receipt.amountKobo / 100)}`);
  }
  if (receipt.senderName) {
    parts.push(`Sender: ${receipt.senderName}`);
  }
  if (receipt.paidOn) {
    parts.push(`Date: ${receipt.paidOn}`);
  }
  if (receipt.reference) {
    parts.push(`Reference: ${receipt.reference}`);
  }

  const details =
    parts.length > 0 ? `${parts.join(". ")}.` : "No readable details.";

  return `${RECEIPT_PREFIX} ${details}`;
}

/**
 * Turns an incoming photo into a customer message.
 *
 * The image is described with Groq Vision, then stored as a `Message` with
 * `messageType: "image"` and the image metadata. The description is mirrored
 * into `content` as well, so the rest of the app (chat UI, history, and the AI
 * reply flow) keeps treating the message like any other text.
 *
 * When the picture is not a product it is read as a possible payment receipt.
 * The extracted amount, sender, date and reference replace the description, so
 * the assistant can call `generate_invoice_from_receipt` instead of guessing
 * from a picture it cannot see.
 *
 * Mirrors the conversation lookup in `lib/voice-pipeline.ts`: reuse the
 * customer's most recent conversation, or start a fresh OPEN one.
 */
export async function processImageMessage(args: {
  businessId: string;
  customerId: string;
  imageUrl: string;
  /**
   * Text the customer attached to the picture (a Telegram caption, for
   * example). It is appended to the stored text so the AI and the dashboard
   * read the picture and the words around it as one message.
   */
  caption?: string;
}): Promise<ProcessedImageMessage> {
  const { businessId, customerId, imageUrl } = args;

  const { description, isProduct } = await describeImage(imageUrl);

  // Receipt reading is best-effort: a failed second vision call must never lose
  // the customer's message, so the plain description is used instead.
  let receipt: ReceiptExtraction | null = null;
  if (!isProduct) {
    try {
      const extracted = await readReceipt(imageUrl);
      receipt = extracted.isReceipt ? extracted : null;
    } catch (error) {
      console.warn(
        "[image-pipeline] receipt read failed, using the image description:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const summary = receipt ? receiptSummary(receipt) : description;
  const caption = args.caption?.trim().slice(0, MAX_CAPTION_LENGTH) ?? "";
  const content = caption
    ? `${summary}\nCustomer's caption: ${caption}`
    : summary;

  let conversation = await prisma.conversation.findFirst({
    where: { businessId, customerId },
    orderBy: { createdAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { businessId, customerId, status: "AI_HANDLING" },
    });
  }

  const message = await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "customer",
      messageType: "image",
      imageUrl,
      imageDescription: content,
      content,
    },
  });

  return {
    messageId: message.id,
    description: content,
    isProduct,
    conversationId: conversation.id,
    receipt,
  };
}
