import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { processVoiceNote } from "@/lib/voice-pipeline";
import { processImageMessage } from "@/lib/image-pipeline";
import {
  chargeAiReply,
  handleIncomingMessage,
  refundAiReply,
} from "@/lib/chat-engine";
import { askAI, type AIResult } from "@/lib/ai";
import { LOW_CREDIT_MESSAGE } from "@/lib/plans";

type ChatRequestBody = {
  businessId?: unknown;
  customerId?: unknown;
  message?: unknown;
  audioUrl?: unknown;
  imageUrl?: unknown;
  isDashboardAssistant?: unknown;
};

/**
 * System prompt used when the owner talks to the floating "Colly AI" widget on
 * the dashboard. It is owner-facing: help with sales, products and training the
 * bot, and keep answers short and actionable. No customer context applies.
 */
const DASHBOARD_ASSISTANT_PROMPT =
  "You are Colly AI, the internal dashboard assistant for the business owner. " +
  "Help them understand their sales, manage their products, and train their " +
  "WhatsApp/Telegram bot. Keep answers short and actionable.";

// POST /api/chat
// Body: { businessId: string, customerId: string, message: string }
//   or: { businessId: string, customerId: string, audioUrl: string }
//   or: { businessId: string, customerId: string, imageUrl: string }
//
// Thin wrapper around the shared chat engine (`lib/chat-engine.ts`), which owns
// the whole AI reply flow (history, prompt, tools, negotiation, usage). This
// route only handles the dashboard / server entry points: authentication,
// tenant scoping, and turning an incoming voice note or image into text before
// the engine runs. The Telegram webhook calls the engine directly.
//
// When `audioUrl` or `imageUrl` is present, the audio/image is processed first
// and the transcript/description stands in for `message`; priority is audioUrl >
// imageUrl > message. `businessId` may be omitted when the caller is signed in,
// in which case the session decides the tenant. A caller with no dashboard
// session (e.g. the future WhatsApp webhook) must send the shared secret in the
// `X-Colly-Internal-Secret` header (CHAT_INTERNAL_SECRET); without it the
// request is rejected, so an anonymous caller cannot target another tenant.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const { customerId } = body;
    const messageText = typeof body.message === "string" ? body.message : "";
    // Priority for effectiveMessage: audioUrl > imageUrl > message
    const audioUrl =
      typeof body.audioUrl === "string" && body.audioUrl.length > 0
        ? body.audioUrl
        : null;
    const imageUrl =
      typeof body.imageUrl === "string" && body.imageUrl.length > 0
        ? body.imageUrl
        : null;

    const user = await getCurrentUser();

    let businessId =
      typeof body.businessId === "string" && body.businessId.length > 0
        ? body.businessId
        : null;

    if (user) {
      // A signed-in caller can only post to its own business.
      if (businessId && businessId !== user.businessId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      businessId = user.businessId;
    } else {
      // No session: only trusted server-to-server callers may pass a
      // businessId, and only with the shared secret. Otherwise an anonymous
      // caller could write into any tenant and drain its credits.
      const secret = request.headers.get("x-colly-internal-secret");
      const expected = process.env.CHAT_INTERNAL_SECRET;

      if (!expected || secret !== expected) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // The dashboard's floating "Colly AI" widget talks to the owner, not a
    // customer. It carries no customerId, so it takes a dedicated owner-facing
    // path: the AI is given the business context and the dashboard system
    // prompt, and no customer conversation is created.
    if (body.isDashboardAssistant === true) {
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (messageText.trim().length === 0) {
        return Response.json({ error: "message is required" }, { status: 400 });
      }

      const business = await prisma.business.findUnique({
        where: { id: user.businessId },
        select: { name: true, description: true, channel: true },
      });

      // The owner's own assistant is metered exactly like a customer AI reply:
      // the credits are reserved BEFORE the model call, with the same atomic
      // compare-and-swap the chat engine uses. Without this the flag in the
      // request body was enough to loop the widget for free — no plan gate, no
      // charge, no rate limit — and burn provider tokens indefinitely. Manual
      // (agent) replies stay free; only generated answers cost credits.
      const debit = await chargeAiReply(user.businessId, business?.channel ?? null);
      if (!debit) {
        return Response.json(
          { error: LOW_CREDIT_MESSAGE, blocked: true, reason: "no_credits" },
          { status: 402 },
        );
      }

      let context = `Business name: ${business?.name ?? user.businessName}.`;
      if (business?.description) {
        context += ` Business description: ${business.description}`;
      }

      let result: AIResult;
      try {
        result = await askAI([
          { role: "system", content: DASHBOARD_ASSISTANT_PROMPT },
          { role: "system", content: context },
          { role: "user", content: messageText },
        ]);
      } catch (error) {
        // No answer reached the owner, so the reservation goes straight back.
        await refundAiReply(user.businessId, debit);
        throw error;
      }

      if (result.provider === "fallback") {
        // Every provider failed: that reply is a static apology, not an answer,
        // so it is refunded exactly like a customer-side provider outage.
        await refundAiReply(user.businessId, debit);
        return Response.json(
          {
            error: "The AI is unavailable right now. You were not charged.",
            blocked: true,
            reason: "ai_unavailable",
          },
          { status: 503 },
        );
      }

      return Response.json({ reply: result.reply });
    }

    if (
      !businessId ||
      typeof customerId !== "string" ||
      customerId.length === 0 ||
      (!audioUrl && !imageUrl && messageText.length === 0)
    ) {
      return Response.json(
        {
          error:
            "businessId, customerId and either message, audioUrl or imageUrl are required",
        },
        { status: 400 },
      );
    }

    // The customer has to belong to this business, otherwise a caller could
    // graft a message onto another tenant's customer.
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, phone: true },
    });

    if (!customer) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    // Resolve the effective text. A voice note or image is processed first
    // (audioUrl > imageUrl priority); the pipeline already stores that as the
    // customer's message, so the engine is told not to save it again.
    let effectiveMessage = messageText;
    let customerMessageAlreadySaved = false;

    if (audioUrl) {
      const voice = await processVoiceNote({
        businessId,
        customerId,
        audioUrl,
      });
      effectiveMessage = voice.transcript;
      customerMessageAlreadySaved = true;
    } else if (imageUrl) {
      const image = await processImageMessage({
        businessId,
        customerId,
        imageUrl,
      });
      effectiveMessage = image.description;
      customerMessageAlreadySaved = true;
    }

    // The engine saves the customer message, honors human takeover, applies the
    // plan/credit gate, generates the reply and records usage.
    const result = await handleIncomingMessage({
      businessId,
      customerPhone: customer.phone,
      message: effectiveMessage,
      skipCustomerMessage: customerMessageAlreadySaved,
    });

    if (result.blocked) {
      if (result.reason === "no_message") {
        return Response.json(
          {
            error:
              "businessId, customerId and either message, audioUrl or imageUrl are required",
          },
          { status: 400 },
        );
      }

      // "paused" (human takeover) or a plan/credit gate (cap_hit /
      // plan_expired / no_credits): no AI reply is produced, but the customer
      // message was still saved so the owner can answer manually.
      return Response.json({ reply: null, paused: true });
    }

    return Response.json({ reply: result.reply });
  } catch (error) {
    console.error("[POST /api/chat]", error);
    return Response.json(
      {
        error: "Failed to send message",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
