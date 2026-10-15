// Telegram alerting for "something broke" signals (e.g. the AI fallback chain).
//
// Alerts are best-effort: a missing token/chat id or a failed request is logged
// and swallowed so alerting can never take down the caller. Identical messages
// are also rate limited to one per five minutes to avoid a flood when a provider
// is down and every request fails.

const TELEGRAM_SEND_URL = "https://api.telegram.org";

const RATE_LIMIT_MS = 5 * 60 * 1000;

export type AlertSeverity = "info" | "warning" | "critical";

// message text -> Date.now() of the last time it was sent.
const lastSentAt = new Map<string, number>();

function formatMessage(message: string, severity: AlertSeverity): string {
  const prefix =
    severity === "critical"
      ? "🔴 CRITICAL"
      : severity === "warning"
        ? "🟡 WARNING"
        : "ℹ️ INFO";

  return `${prefix}\n${message}`;
}

/**
 * Sends a Telegram message to the configured chat.
 *
 * Never throws: missing configuration and network/API failures are logged and
 * ignored. The same message text is sent at most once every five minutes.
 */
export async function sendAlert(
  message: string,
  severity: AlertSeverity,
): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("[alerts] Telegram not configured");
      return;
    }

    const now = Date.now();
    const last = lastSentAt.get(message);
    if (last !== undefined && now - last < RATE_LIMIT_MS) {
      return;
    }
    lastSentAt.set(message, now);

    await fetch(`${TELEGRAM_SEND_URL}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatMessage(message, severity),
      }),
    });
  } catch (error) {
    // Alerts are best-effort: log and never throw.
    console.error("[alerts] Telegram send failed:", error);
  }
}

// provider name -> last known state, so we only alert on transitions.
const providerState = new Map<string, "up" | "down">();

/**
 * Alerts only when a provider's up/down state changes, so repeated failures
 * (each with a unique request id) do not spam the chat. The first failure
 * alerts, further failures stay silent, and a later success alerts recovery.
 */
export async function alertProviderState(
  provider: string,
  state: "up" | "down",
  reason?: string,
): Promise<void> {
  const previous = providerState.get(provider);
  if (previous === state) return; // no change, no alert

  providerState.set(provider, state);

  if (state === "down") {
    await sendAlert(
      `Provider ${provider} is DOWN. Reason: ${(reason ?? "unknown").slice(0, 150)}. Fallback active.`,
      "warning",
    );
  } else {
    await sendAlert(`Provider ${provider} is back UP. Normal operation resumed.`, "info");
  }
}
