import { prisma } from "@/lib/prisma";
import { transcribeAudio } from "@/lib/stt";

export type ProcessedVoiceNote = {
  /** The `Message` row that was created for this voice note. */
  messageId: string;
  /** Whisper's transcript of the audio. */
  transcript: string;
  /** The conversation the message landed in. */
  conversationId: string;
};

/**
 * Turns an incoming WhatsApp voice note into a normal customer message.
 *
 * The audio is transcribed with Groq Whisper, then stored as a `Message` with
 * `messageType: "voice"` and the audio metadata. The transcript is mirrored
 * into `content` as well, so the rest of the app (chat UI, history, and the AI
 * reply flow) keeps treating the message like any other text.
 *
 * Mirrors the conversation lookup in the text path of
 * `app/api/chat/route.ts`: reuse the customer's most recent conversation, or
 * start a fresh OPEN one.
 */
export async function processVoiceNote(args: {
  businessId: string;
  customerId: string;
  audioUrl: string;
  /** Client-reported duration in seconds; Whisper's own value is the fallback. */
  duration?: number;
}): Promise<ProcessedVoiceNote> {
  const { businessId, customerId, audioUrl } = args;

  const { text, duration } = await transcribeAudio(audioUrl);

  let conversation = await prisma.conversation.findFirst({
    where: { businessId, customerId },
    orderBy: { createdAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { businessId, customerId, status: "OPEN" },
    });
  }

  const audioDuration = Math.round(
    typeof args.duration === "number" && Number.isFinite(args.duration)
      ? args.duration
      : duration,
  );

  const message = await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "customer",
      messageType: "voice",
      audioUrl,
      audioDuration,
      transcript: text,
      content: text,
    },
  });

  return {
    messageId: message.id,
    transcript: text,
    conversationId: conversation.id,
  };
}
