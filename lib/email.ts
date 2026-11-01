/**
 * Transactional email (Resend).
 *
 * The single place the app talks to an email provider. Everything that sends
 * mail goes through `sendEmail()`: the weekly business report
 * (`app/api/reports/weekly/route.ts`) and the team invitation
 * (`lib/team-invite.ts`).
 *
 * Email is always a *notification* channel, never the source of truth. Every
 * caller must therefore keep working when `RESEND_API_KEY` is unset or the
 * provider is down: `sendEmail()` reports `{ sent: false, error }` instead of
 * throwing, exactly like `sendEscalationAlert()` treats Telegram. The invite
 * row is written before the mail is attempted, and the weekly report is still
 * rendered in the dashboard when the mail fails.
 *
 * The provider's error body is deliberately not logged: it echoes the
 * recipient address, and hosting log retention is the cheapest PII leak there
 * is.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Sender used when `RESEND_FROM_EMAIL` is not configured. */
export const DEFAULT_EMAIL_FROM = "Colly <reports@colly.com.ng>";

/** A hung provider must not hold an API request open for a minute. */
const REQUEST_TIMEOUT_MS = 10_000;

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Screens readers and spam filters expect one. */
  text?: string;
  /** Overrides `RESEND_FROM_EMAIL` for this message only. */
  from?: string;
};

/**
 * `error` is a short machine-readable reason (`not_configured`,
 * `resend_<status>`, `request_failed`) — never the provider's raw body.
 */
export type EmailResult = { sent: boolean; error?: string };

/** True when the app can actually send mail. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** The `from` header: `RESEND_FROM_EMAIL`, else `DEFAULT_EMAIL_FROM`. */
export function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_EMAIL_FROM;
}

/**
 * Minimal HTML escaping for values interpolated into an email body. Emails are
 * built by hand (no template engine), so a business name such as
 * `Ada & Sons <Lagos>` must not be able to break the markup.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send one transactional email. Never throws — a caller that also writes to
 * the database keeps its own success path.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    // Production-visible but PII-free: no address, no body.
    console.warn("[email] RESEND_API_KEY is not set — skipping outgoing email");
    return { sent: false, error: "not_configured" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from?.trim() || fromAddress(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[email] Resend rejected the message (${response.status})`);
      return { sent: false, error: `resend_${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error(
      "[email] Resend request failed:",
      error instanceof Error ? error.name : "unknown error",
    );
    return { sent: false, error: "request_failed" };
  }
}
