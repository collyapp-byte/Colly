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

    let business = await prisma.business.findFirst({
      where: { telegramChatId, channel: "TELEGRAM" },
      select: { id: true, telegramBotToken: true },
    });

    // First message from a freshly connected bot: no business has claimed this
    // chat yet. Work out which bot received the update, save chat.id as the
    // business's telegramChatId and carry on — every later message from this
    // chat then resolves on the lookup above.
    if (!business) {
      const unlinked = await findUnlinkedBusiness(request);
      if (unlinked) {
        await prisma.business.update({
          where: { id: unlinked.id },
          data: { telegramChatId },
        });
        business = unlinked;
      }
    }

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

    // The engine always saves the customer's message first (so the owner can
    // reply manually from the dashboard). When replied is false the AI is
    // gated off — human takeover, cap hit, expired plan — so we stay silent
    // and just acknowledge the update to Telegram.
    if (result.blocked || !result.reply) {
      if (!result.replied) {
        console.log(
          `[telegram webhook] message saved, AI reply skipped (reason: ${result.blocked ? result.reason : "no_reply"})`,
        );
      }
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

/**
 * Finds the business a webhook update belongs to when no business has claimed
 * the incoming chat yet (a bot that was just connected, first message).
 *
 * All bots share one webhook URL, so the update body does not name the
 * business. Telegram does echo back the `secret_token` registered at connect
 * time (a base64url copy of the bot token) as a header, which identifies the
 * bot — and therefore the business with that `telegramBotToken`. If the header
 * is missing, the only fallback that is safe is the single business still
 * waiting to be linked: with several pending businesses there is nothing to
 * tell them apart, so we link none of them rather than the wrong one.
 */
async function findUnlinkedBusiness(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");

  if (secret) {
    const botToken = Buffer.from(secret, "base64url").toString("utf8");
    if (botToken) {
      const byToken = await prisma.business.findFirst({
        where: {
          channel: "TELEGRAM",
          telegramBotToken: botToken,
          telegramChatId: null,
        },
        select: { id: true, telegramBotToken: true },
      });
      if (byToken) return byToken;
    }
  }

  const pending = await prisma.business.findMany({
    where: {
      channel: "TELEGRAM",
      telegramBotToken: { not: null },
      telegramChatId: null,
    },
    select: { id: true, telegramBotToken: true },
    take: 2,
  });

  return pending.length === 1 ? pending[0] : null;
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
