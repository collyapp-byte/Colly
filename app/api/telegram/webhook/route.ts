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

// POST /api/telegram/webhook?token=<botToken>
// Telegram posts every update here. The bot token rides along as a query
// param (registered by /api/telegram/connect) so even the very first message
// resolves its business — no secret header gymnastics, no dropped chats.
//
// NOTE: processing runs synchronously (no `after()`) while we trace a silent
// webhook drop. This risks a Telegram timeout/retry on a slow DeepSeek call;
// once the drop is fixed we can move the slow path back into `after()`.
//
// Always answers 200 so Telegram does not retry a non-2xx response.
export async function POST(request: Request) {
  try {
    const update = (await request.json()) as TelegramUpdate;
    console.log(
      "[WEBHOOK HIT] Received Telegram update:",
      JSON.stringify(update, null, 2),
    );

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

    const token = new URL(request.url).searchParams.get("token");
    console.log("[WEBHOOK] Resolving business for token:", token);

    const business = await resolveBusiness(request, telegramChatId);
    if (!business) {
      console.log("[WEBHOOK] No business found. Exiting.");
      return Response.json({ ok: true });
    }
    console.log("[WEBHOOK] Found business:", business.id);

    if (!business.telegramBotToken) {
      console.log("[WEBHOOK] Business has no bot token. Exiting.");
      return Response.json({ ok: true });
    }

    // First message from a freshly connected bot: claim this chat for the
    // business so later updates resolve on the plain chat-id lookup.
    if (!business.telegramChatId) {
      console.log("[WEBHOOK] Linking chat", telegramChatId, "to business", business.id);
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

    console.log("[WEBHOOK] Calling chat engine for chat:", telegramChatId);
    const result = await handleIncomingMessage({
      businessId: business.id,
      customerPhone: telegramChatId,
      message: text,
    });
    console.log("[WEBHOOK] Chat engine result:", JSON.stringify(result));

    // The engine always saves the customer's message first (so the owner can
    // reply manually from the dashboard). When replied is false the AI is
    // gated off — human takeover, cap hit, expired plan — so we stay silent.
    if (result.blocked || !result.reply) {
      if (!result.replied) {
        console.log(
          `[WEBHOOK] message saved, AI reply skipped (reason: ${result.blocked ? result.reason : "no_reply"})`,
        );
      }
      return Response.json({ ok: true });
    }

    console.log("[WEBHOOK] Sending reply to Telegram");
    await sendTelegramMessage({
      botToken: business.telegramBotToken,
      chatId: telegramChatId,
      text: result.reply,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[WEBHOOK ERROR] Failed to process message:", error);
    // Telegram retries non-2xx responses, so failures are swallowed here.
    return Response.json({ ok: true });
  }
}

/**
 * Resolves the business a webhook update belongs to:
 *
 * 1. The `token` query param (bot token) registered at connect time — works
 *    from the very first message, before any chat is linked.
 * 2. The claimed `telegramChatId` — the fast path for every later message.
 * 3. The `secret_token` header (base64url bot token) as a fallback for bots
 *    whose webhook was registered by an older connect call without the query
 *    param; with several unlinked businesses there is nothing to tell them
 *    apart, so we link none rather than the wrong one.
 */
async function resolveBusiness(
  request: Request,
  telegramChatId: string,
): Promise<{
  id: string;
  telegramBotToken: string | null;
  telegramChatId: string | null;
} | null> {
  const select = { id: true, telegramBotToken: true, telegramChatId: true } as const;

  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    const byToken = await prisma.business.findFirst({
      where: { channel: "TELEGRAM", telegramBotToken: token },
      select,
    });
    if (byToken) return byToken;
  }

  const byChat = await prisma.business.findFirst({
    where: { telegramChatId, channel: "TELEGRAM" },
    select,
  });
  if (byChat) return byChat;

  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret) {
    const secretToken = Buffer.from(secret, "base64url").toString("utf8");
    if (secretToken) {
      const bySecret = await prisma.business.findFirst({
        where: {
          channel: "TELEGRAM",
          telegramBotToken: secretToken,
          telegramChatId: null,
        },
        select,
      });
      if (bySecret) return bySecret;
    }
  }

  const pending = await prisma.business.findMany({
    where: {
      channel: "TELEGRAM",
      telegramBotToken: { not: null },
      telegramChatId: null,
    },
    select,
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
