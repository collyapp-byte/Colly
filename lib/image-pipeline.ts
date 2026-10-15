import { prisma } from "@/lib/prisma";
import { describeImage } from "@/lib/vision";

export type ProcessedImageMessage = {
  messageId: string;
  description: string;
  isProduct: boolean;
  conversationId: string;
};

/**
 * Turns an incoming photo into a customer message.
 *
 * The image is described with Groq Vision, then stored as a `Message` with
 * `messageType: "image"` and the image metadata. The description is mirrored
 * into `content` as well, so the rest of the app (chat UI, history, and the AI
 * reply flow) keeps treating the message like any other text.
 *
 * Mirrors the conversation lookup in `lib/voice-pipeline.ts`: reuse the
 * customer's most recent conversation, or start a fresh OPEN one.
 */
export async function processImageMessage(args: {
  businessId: string;
  customerId: string;
  imageUrl: string;
}): Promise<ProcessedImageMessage> {
  const { businessId, customerId, imageUrl } = args;

  const { description, isProduct } = await describeImage(imageUrl);

  let conversation = await prisma.conversation.findFirst({
    where: { businessId, customerId },
    orderBy: { createdAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { businessId, customerId, status: "OPEN" },
    });
  }

  const message = await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "customer",
      messageType: "image",
      imageUrl,
      imageDescription: description,
      content: description,
    },
  });

  return {
    messageId: message.id,
    description,
    isProduct,
    conversationId: conversation.id,
  };
}
