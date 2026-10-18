import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/chat-engine";

// The slice of a Telegram update we care about.
type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    from?: { first_name?: string };
    text?: string;
  };
};

// POST /api/telegram/webhook
// Telegram posts every update here. We answer only plain text messages sent to a
// business whose `telegramChatId` matches the chat: the shared chat engine
// (`lib/chat-engine.ts`) produces the reply and we hand it back to the Bot API.
//
// Always answers 200 so Telegram does not retry a non-2xx response.
export async function POST(request: Request) {
  try {
    const update = (await request.json()) as TelegramUpdate;
    const chatIdRaw = update.message?.chat?.id;
    const text = update.message?.text;

    // No chat, or no text (stickers, joins, edits, ...): nothing to answer.
    if (
      chatIdRaw === undefined ||
      chatIdRaw === null ||
      typeof text !== "string" ||
      text.trim().length === 0
    ) {
      return Response.json({ ok: true });
    }

    const telegramChatId = String(chatIdRaw);

    const business = await prisma.business.findFirst({
      where: { telegramChatId, channel: "TELEGRAM" },
      select: { id: true, telegramBotToken: true },
    });

    // Not a chat we manage, or the bot has no token to reply with.
    if (!business || !business.telegramBotToken) {
      return Response.json({ ok: true });
    }

    // The chat id stands in for the customer's phone number. Keep any name a
    // previous update (or the owner) already set, and default to first_name.
    const customerName =
      update.message?.from?.first_name?.trim() || telegramChatId;

    await prisma.customer.upsert({
      where: {
        businessId_phone: { businessId: business.id, phone: telegramChatId },
      },
      update: {},
      create: {
        businessId: business.id,
        name: customerName,
        phone: telegramChatId,
      },
    });

    const result = await handleIncomingMessage({
      businessId: business.id,
      customerPhone: telegramChatId,
      message: text,
    });

    // cap_hit / ai_disabled / paused: stay silent rather than send noise.
    if (result.blocked || !result.reply) {
      return Response.json({ ok: true });
    }

    await sendTelegramMessage({
      botToken: business.telegramBotToken,
      chatId: telegramChatId,
      text: result.reply,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/telegram/webhook]", error);
    // Telegram retries non-2xx responses, so failures are swallowed here.
    return Response.json({ ok: true });
  }
}

async function sendTelegramMessage(args: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${args.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: args.chatId, text: args.text }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      `[telegram] sendMessage failed (${response.status}): ${detail}`,
    );
  }
}
