import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/chat-engine";
import { checkRateLimit } from "@/lib/rate-limit";

// The slice of a Telegram update we care about.
type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    from?: { first_name?: string };
    text?: string;
  };
};

// POST /api/telegram/webhook?token=<botToken>
// Telegram posts every update here. The bot token rides along as a query
// param (registered by /api/telegram/connect) so even the very first message
// resolves its business — no secret header gymnastics, no dropped chats.
//
// NOTE: processing runs synchronously (no `after()`) while we trace a silent
// webhook drop. This risks a Telegram timeout/retry on a slow DeepSeek call;
// once the drop is fixed we can move the slow path back into `after()`.
//
// Accepted updates answer 200 so Telegram does not retry them.
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!checkRateLimit(ip, 60, 60000)) {
    return new Response("Too many requests", { status: 429 });
  }

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
      return new Response("OK", { status: 200 });
    }

    const telegramChatId = String(chatIdRaw);
    const customerName =
      update.message?.from?.first_name?.trim() || telegramChatId;

    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { telegramBotToken: token },
    });

    if (!business) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!business.telegramBotToken) {
      return Response.json({ ok: true });
    }

    // Owner-linking command. "/startowner" (or "/linkowner") claims this chat
    // as the owner's personal alert inbox. Intercepted BEFORE the AI engine so
    // it never reaches DeepSeek, and never creates a customer conversation.
    const normalized = text.toLowerCase().replace(/[\s.]/g, "");
    if (normalized === "/startowner" || normalized === "/linkowner") {
      await prisma.business.update({
        where: { id: business.id },
        data: { ownerTelegramChatId: telegramChatId },
      });

      await sendTelegramMessage({
        botToken: business.telegramBotToken,
        chatId: telegramChatId,
        text: "✅ Success! You will now receive owner alerts for this business.",
      });

      return Response.json({ ok: true });
    }

    // First message from a freshly connected bot: record this chat for the
    // business while every update continues to resolve by bot token.
    if (!business.telegramChatId) {
      await prisma.business.update({
        where: { id: business.id },
        data: { telegramChatId },
      });
    }

    // The chat id stands in for the customer's phone number.
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
    // gated off — human takeover, cap hit, expired plan — so we stay silent.
    if (result.blocked || !result.reply) {
      return Response.json({ ok: true });
    }

    await sendReplyToTelegram({
      botToken: business.telegramBotToken,
      chatId: telegramChatId,
      reply: result.reply,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[WEBHOOK ERROR] Failed to process message:", error);
    // Telegram retries non-2xx responses, so failures are swallowed here.
    return Response.json({ ok: true });
  }
}

/**
 * The tag the assistant uses to hand a product picture to the channel:
 * `[IMAGE: https://.../photo.jpg]`. The picture itself is sent by the channel
 * (Telegram `sendPhoto`), so the tag never reaches the customer as text.
 */
const IMAGE_TAG = /\[IMAGE:\s*([^\]]+?)\s*\]/i;

/** Same tag, but matching every occurrence so none is left in the text. */
const IMAGE_TAG_ALL = /\[IMAGE:\s*[^\]]+?\s*\]/gi;

/**
 * Split an assistant reply into the text the customer reads and the picture
 * URL the channel should send as a photo. The tag is removed from the text;
 * a reply without a tag is returned untouched.
 */
function splitImageTag(reply: string): { text: string; imageUrl: string | null } {
  const match = reply.match(IMAGE_TAG);

  if (!match) {
    return { text: reply.trim(), imageUrl: null };
  }

  const imageUrl = match[1].trim();
  const text = reply.replace(IMAGE_TAG_ALL, "").trim();

  return { text, imageUrl: imageUrl.length > 0 ? imageUrl : null };
}

/** Send the assistant reply, as text and/or as a photo. */
async function sendReplyToTelegram(args: {
  botToken: string;
  chatId: string;
  reply: string;
}): Promise<void> {
  const { text, imageUrl } = splitImageTag(args.reply);

  if (text.length > 0) {
    await sendTelegramMessage({
      botToken: args.botToken,
      chatId: args.chatId,
      text,
    });
  }

  if (imageUrl) {
    await sendTelegramPhoto({
      botToken: args.botToken,
      chatId: args.chatId,
      photo: imageUrl,
    });
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

/** Send a picture to the customer (product photo by public URL). */
async function sendTelegramPhoto(args: {
  botToken: string;
  chatId: string;
  photo: string;
  caption?: string;
}): Promise<void> {
  const body: Record<string, string> = {
    chat_id: args.chatId,
    photo: args.photo,
  };

  if (args.caption) {
    body.caption = args.caption;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${args.botToken}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      `[telegram] sendPhoto failed (${response.status}): ${detail}`,
    );
  }
}
