import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

type MessageRequestBody = {
  content?: unknown;
};

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function notFound() {
  return Response.json({ error: "Conversation not found" }, { status: 404 });
}

// POST /api/conversations/[id]/messages
// An agent (a human on the team) replies in a conversation they have taken
// over. The row is stored with sender "agent" so the UI can render it as the
// business's own voice, separate from the AI's replies.
//
// Credit Economy: manual replies are free — they spend 0 credits — so an empty
// balance never blocks an owner from answering a customer. The reply counters
// are still incremented for usage reporting.
export async function POST(
  request: Request,
  context: RouteContext<"/api/conversations/[id]/messages">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    const body = (await request.json()) as MessageRequestBody;
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return Response.json({ error: "Message content is required" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, businessId },
      include: { customer: true, business: true },
    });

    if (!conversation) {
      return notFound();
    }

    // Manual replies spend 0 credits, so there is nothing to charge — only the
    // usage counters move. The counters and the message are written together so
    // a failed insert never leaves a phantom reply in the usage figures.
    const [, message] = await prisma.$transaction([
      prisma.business.update({
        where: { id: businessId },
        data: {
          manualMessagesUsedThisMonth: { increment: 1 },
          // Trial counter: how many manual replies the 7-day trial has spent.
          manualMessagesUsed: { increment: 1 },
        },
      }),
      prisma.message.create({
        data: {
          businessId,
          conversationId: conversation.id,
          sender: "agent",
          content,
        },
      }),
    ]);

    // Relay the saved reply to the customer's Telegram chat. Telegram customers
    // store their chat id in `Customer.phone` (see the Telegram webhook). A
    // failed send must not fail the request: the dashboard message is saved.
    try {
      const chatId = conversation.customer.phone?.trim();
      const botToken = conversation.business.telegramBotToken;

      if (
        conversation.business.channel === "TELEGRAM" &&
        chatId &&
        botToken
      ) {
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: content }),
            signal: AbortSignal.timeout(10_000),
          },
        );

        if (!telegramResponse.ok) {
          const detail = await telegramResponse.text().catch(() => "");
          console.error(
            `[POST /api/conversations/[id]/messages] Telegram send failed (${telegramResponse.status}): ${detail}`,
          );
        }
      }
    } catch (error) {
      console.error(
        "[POST /api/conversations/[id]/messages] Telegram relay failed:",
        error,
      );
    }

    return Response.json(
      {
        message: {
          id: message.id,
          sender: message.sender,
          content: message.content,
          createdAt: message.createdAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/conversations/[id]/messages]", error);
    return Response.json(
      {
        error: "Failed to send message",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
