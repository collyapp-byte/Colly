import { prisma } from "@/lib/prisma";

/**
 * Telegram Bot API root. `COLLY_TELEGRAM_BOT_TOKEN` is the token of the
 * Colly-wide admin bot — a DIFFERENT bot from `Business.telegramBotToken`,
 * which answers the business's own customers. The admin bot only messages the
 * owner's personal chat (alerts, escalations), so it never touches customer
 * conversations.
 */
const TELEGRAM_API = "https://api.telegram.org";

/**
 * The Colly-wide bot tokens that can reach the owner's personal chat, in
 * priority order.
 *
 * `COLLY_TELEGRAM_BOT_TOKEN` is the documented admin bot. `TELEGRAM_BOT_TOKEN`
 * is the bot used for system alerts (see lib/alerts.ts) and is the one that is
 * actually configured in most deployments, so it is kept as a fallback.
 */
function adminBotTokens(): string[] {
  const tokens = [
    process.env.COLLY_TELEGRAM_BOT_TOKEN?.trim(),
    process.env.TELEGRAM_BOT_TOKEN?.trim(),
  ];

  return [
    ...new Set(
      tokens.filter(
        (token): token is string => typeof token === "string" && token.length > 0,
      ),
    ),
  ];
}

/**
 * The chat id the owner's alerts go to.
 *
 * The business's own `ownerTelegramChatId` (set by `/startowner` in the
 * Telegram webhook, or by the owner in the dashboard) always wins. The
 * configured system-alert chat id is the fallback so an escalation is still
 * delivered for a business whose owner never linked their personal chat.
 */
function resolveOwnerChatId(ownerChatId: string | null | undefined): string | null {
  const chatId =
    ownerChatId?.trim() || process.env.TELEGRAM_CHAT_ID?.trim() || "";

  return chatId.length > 0 ? chatId : null;
}

/**
 * Send `text` to `chatId`, trying each bot token in turn.
 *
 * A Telegram bot may only message a chat that has started a conversation with
 * it, so the first token can fail (403 "bot can't initiate conversation with
 * this user") while another one works. Returns true when a token delivered
 * the message; never throws.
 */
async function deliverTelegramMessage(
  tokens: string[],
  chatId: string,
  text: string,
): Promise<boolean> {
  if (tokens.length === 0) {
    return false;
  }

  let lastError = "no bot token configured";

  for (const token of tokens) {
    try {
      const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        console.log("[owner-alerts] Telegram message delivered to chat", chatId);
        return true;
      }

      const data = (await response.json().catch(() => null)) as {
        description?: string;
      } | null;
      lastError = `${response.status} ${data?.description ?? "unknown error"}`;
      console.error("[owner-alerts] Telegram sendMessage failed:", lastError);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error("[owner-alerts] Telegram sendMessage threw:", lastError);
    }
  }

  console.error("[owner-alerts] Telegram message NOT delivered:", lastError);
  return false;
}

/**
 * Send an escalation alert to the owner's personal Telegram.
 *
 * Called by the `escalate_to_owner` tool in lib/chat-engine.ts whenever the AI
 * hits a question it cannot answer (waybill, custom quote, specs beyond the
 * product description). Silent no-op when the owner has not connected their
 * personal chat id yet, and never throws — a failed alert must not break the
 * customer's chat reply, so every error is logged and swallowed.
 */
export async function sendOwnerAlert(
  businessId: string,
  message: string,
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        ownerTelegramChatId: true,
        telegramBotToken: true,
        name: true,
      },
    });

    if (!business) {
      console.warn(
        `[owner-alerts] escalation not delivered: business ${businessId} not found.`,
      );
      return;
    }

    console.log(
      "[OWNER ALERT] Attempting to send alert. ownerTelegramChatId:",
      business.ownerTelegramChatId,
    );

    const chatId = resolveOwnerChatId(business.ownerTelegramChatId);

    if (!chatId) {
      console.log("[OWNER ALERT] No Chat ID found. Skipping alert.");
      console.warn(
        `[owner-alerts] escalation for "${business.name}" not delivered: no ownerTelegramChatId set.`,
      );
      return;
    }

    // The admin bot first (it only ever messages the owner's own chat), the
    // business's own bot as the fallback.
    const tokens = [
      ...adminBotTokens(),
      business.telegramBotToken?.trim(),
    ].filter((token): token is string => Boolean(token));

    await deliverTelegramMessage(tokens, chatId, message);
  } catch (error) {
    // Logged, never rethrown: the chat pipeline must survive an alert failure.
    console.error(
      "[owner-alerts] failed to send owner alert:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Deliver an `escalate_to_owner` escalation to the owner's personal Telegram
 * chat.
 *
 * Requires the owner's Telegram chat id and the customer's message: without a
 * chat id there is nobody to reach, and without the message the owner cannot
 * help. The business's own bot is tried first — that is the bot the owner's
 * chat is registered with, so "reply directly to this chat" reaches the
 * business — then the Colly admin bot, then the system alert bot.
 *
 * Never throws: a failed escalation must not break the customer's reply.
 */
export async function sendEscalationAlert(args: {
  businessId: string;
  ownerChatId: string | null;
  customerMessage: string;
  businessBotToken?: string | null;
}): Promise<void> {
  console.log("[TOOL FIRED] escalate_to_owner:", {
    ownerChatId: args.ownerChatId,
    customerMessage: args.customerMessage,
  });

  const chatId = resolveOwnerChatId(args.ownerChatId);
  const customerMessage = args.customerMessage.trim();

  if (!chatId) {
    console.warn(
      `[owner-alerts] escalation for business ${args.businessId} not delivered: no owner Telegram chat id.`,
    );
    return;
  }

  if (!customerMessage) {
    console.warn(
      `[owner-alerts] escalation for business ${args.businessId} not delivered: empty customer message.`,
    );
    return;
  }

  const tokens = [
    args.businessBotToken?.trim(),
    ...adminBotTokens(),
  ].filter((token): token is string => Boolean(token));

  if (tokens.length === 0) {
    console.warn(
      `[owner-alerts] escalation for business ${args.businessId} not delivered: no Telegram bot token configured.`,
    );
    return;
  }

  const text =
    "🚨 AI Escalation: A customer needs your help!\n\n" +
    `Customer asked: '${customerMessage}'\n\n` +
    "Reply directly to this chat to take over.";

  await deliverTelegramMessage(tokens, chatId, text);
}
