import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type TelegramConnectBody = {
  botToken?: unknown;
};

/**
 * The webhook URL Telegram must call back: the deployed app origin + the shared
 * handler. Prefers NEXT_PUBLIC_APP_URL (set it to the live public origin,
 * e.g. https://colly.com.ng) because behind a reverse proxy `request.url` is
 * often http://localhost:3000. Falls back to the request's origin only when
 * the env var is missing. Reported as null when there is no public HTTPS
 * origin to register (Telegram rejects localhost, so connecting would only
 * fail at setWebhook with an opaque error).
 */
function webhookUrl(request: Request): string | null {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base =
    envBase && envBase.length > 0
      ? envBase
      : new URL(request.url).origin;

  let url: URL;
  try {
    url = new URL(`${base.replace(/\/+$/, "")}/api/telegram/webhook`);
  } catch {
    return null;
  }

  const isLocalhost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "0.0.0.0";
  if (url.protocol !== "https:" || isLocalhost) return null;

  return url.toString();
}

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

// POST /api/telegram/connect
// Self-serve Telegram connection. The owner pastes a token from @BotFather; we
// verify it with getMe, point the bot's webhook at our handler (with a secret
// so the webhook can tell our bots apart) and mark the business CONNECTED.
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | TelegramConnectBody
      | null;
    const botToken =
      typeof body?.botToken === "string" ? body.botToken.trim() : "";
    if (!botToken) {
      return badRequest("Bot token is required");
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      select: { id: true },
    });
    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 404 });
    }

    // Fail before calling Telegram when there is no public origin to register:
    // setWebhook would reject localhost anyway, with an error that says nothing
    // about why.
    const hookUrl = webhookUrl(request);
    if (!hookUrl) {
      return badRequest(
        "Telegram requires a public HTTPS URL. Please connect your bot on the live deployed site.",
      );
    }

    // 1. Verify the token against the Bot API. A bad token answers with
    //    { ok: false } (and a 401), never a valid result.
    let me: { ok?: boolean; result?: { username?: string } } | null = null;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`,
        { signal: AbortSignal.timeout(10_000), cache: "no-store" },
      );
      me = await response.json().catch(() => null);
    } catch (error) {
      console.error("[telegram-connect] getMe fetch failed:", error);
      return Response.json(
        {
          error: "Could not reach Telegram",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }
    if (!me?.ok) {
      return badRequest(
        "That bot token is not valid. Copy it from @BotFather and try again.",
      );
    }

    // 2. Register our webhook. The bot token rides along as a query param so
    //    the webhook can identify this business on the very first message
    //    (before any chat.id has been linked). `secret_token` is kept as a
    //    fallback header for bots registered by older connect calls.
    let webhook: { ok?: boolean; description?: string } | null = null;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: `${hookUrl}?token=${encodeURIComponent(botToken)}`,
            secret_token: Buffer.from(botToken, "utf8").toString("base64url"),
            allowed_updates: ["message"],
          }),
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        },
      );
      webhook = await response.json().catch(() => null);
    } catch (error) {
      console.error("[telegram-connect] setWebhook fetch failed:", error);
      return Response.json(
        {
          error: "Could not reach Telegram",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }
    if (!webhook?.ok) {
      // Telegram's own `description` ("Bad Request: bad webhook param ...") is
      // the only actionable detail here, so surface it instead of a fixed line.
      return Response.json(
        {
          error: webhook?.description
            ? `The webhook could not be set: ${webhook.description}`
            : "The token is valid but the webhook could not be set. Try again.",
        },
        { status: 502 },
      );
    }

    // 3. Save the token + bot handle and flip the business to CONNECTED. The
    //    first message from the owner's chat then links chat id -> business in
    //    the webhook, and the AI Line page can show the t.me share link.
    await prisma.business.update({
      where: { id: business.id },
      data: {
        telegramBotToken: botToken,
        telegramBotUsername: me.result?.username ?? null,
        connectionStatus: "CONNECTED",
      },
    });

    return Response.json({
      ok: true,
      botUsername: me.result?.username ?? null,
    });
  } catch (error) {
    console.error("[POST /api/telegram/connect]", error);
    return Response.json(
      { error: "Could not connect your bot. Please try again." },
      { status: 500 },
    );
  }
}

// DELETE /api/telegram/connect
// Disconnect the owner's Telegram bot: clear the stored token/username and
// flip the business back to DISCONNECTED so the AI Line page shows the
// connect form again.
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    await prisma.business.update({
      where: { id: user.businessId },
      data: {
        telegramBotToken: null,
        telegramBotUsername: null,
        connectionStatus: "DISCONNECTED",
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/telegram/connect]", error);
    return Response.json(
      { error: "Could not disconnect your bot. Please try again." },
      { status: 500 },
    );
  }
}
