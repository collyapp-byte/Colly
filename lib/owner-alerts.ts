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
      select: { ownerTelegramChatId: true, name: true },
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

    if (!business.ownerTelegramChatId) {
      console.log("[OWNER ALERT] No Chat ID found. Skipping alert.");
      console.warn(
        `[owner-alerts] escalation for "${business.name}" not delivered: no ownerTelegramChatId set.`,
      );
      return;
    }

    const token = process.env.COLLY_TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      console.warn(
        `[owner-alerts] COLLY_TELEGRAM_BOT_TOKEN is not set; cannot alert the owner of "${business.name}".`,
      );
      return;
    }

    const response = await fetch(
      `${TELEGRAM_API}/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: business.ownerTelegramChatId,
          text: message,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        description?: string;
      } | null;
      console.error(
        `[owner-alerts] Telegram sendMessage failed (${response.status}) for business "${business.name}":`,
        data?.description ?? "unknown error",
      );
    }
  } catch (error) {
    // Logged, never rethrown: the chat pipeline must survive an alert failure.
    console.error(
      "[owner-alerts] failed to send owner alert:",
      error instanceof Error ? error.message : error,
    );
  }
}
