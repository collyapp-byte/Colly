import nacl from "tweetnacl";
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/chat-engine";
import { checkRateLimit } from "@/lib/rate-limit";
import { debugLog } from "@/lib/logger";

const DISCORD_API = "https://discord.com/api/v10";
const FALLBACK_REPLY =
  "Thanks for your message. A member of our team will get back to you shortly.";

type DiscordUser = {
  id?: string;
  username?: string;
  global_name?: string | null;
};

type DiscordOption = {
  name?: string;
  value?: unknown;
  options?: DiscordOption[];
};

type DiscordPayload = {
  /** 1 = PING, 2 = APPLICATION_COMMAND. */
  type?: number;
  application_id?: string;
  token?: string;
  guild_id?: string;
  channel_id?: string;
  /** Plain message body, used by non-interaction callers. */
  content?: string;
  user?: DiscordUser;
  member?: { user?: DiscordUser };
  data?: { name?: string; options?: DiscordOption[] };
};

/**
 * POST /api/discord/webhook[?token=<botToken>]
 *
 * Discord interaction endpoint. Answers the PING handshake with type 1, then
 * resolves the business from the bot token (query param) or the guild id,
 * runs the normal chat engine, and posts the reply back through the
 * interaction webhook.
 *
 * Interactions must be acknowledged within 3 seconds, so the request is
 * acknowledged immediately with a deferred response (type 5) and the slow AI
 * call runs in `after()`, which posts a follow-up webhook when it finishes.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!checkRateLimit(ip, 60, 60000)) {
    return new Response("Too many requests", { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!isValidDiscordSignature(rawBody, signature, timestamp)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: DiscordPayload;
  try {
    payload = JSON.parse(rawBody) as DiscordPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Discord's endpoint verification handshake.
  if (payload.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  const interaction =
    payload.type === 2 &&
    typeof payload.application_id === "string" &&
    typeof payload.token === "string"
      ? { applicationId: payload.application_id, token: payload.token }
      : null;

  const content = readMessageContent(payload);

  if (!content) {
    if (interaction) {
      return NextResponse.json({
        type: 4,
        data: {
          content: "Please send a message so our assistant can help.",
          flags: 64,
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  const token =
    new URL(request.url).searchParams.get("token")?.trim() || null;
  const guildId =
    typeof payload.guild_id === "string" ? payload.guild_id : null;

  const business = await resolveBusiness(token, guildId);
  if (!business) {
    debugLog(
      "[discord] No business found for token or guild id. Exiting.",
    );
    return NextResponse.json({ ok: true });
  }

  const author = payload.member?.user ?? payload.user;
  const authorId =
    typeof author?.id === "string" ? author.id : null;
  const channelId =
    typeof payload.channel_id === "string" ? payload.channel_id : null;

  // The user id (or, failing that, the channel id) stands in for the
  // customer's phone number, mirroring how Telegram uses the chat id.
  const phone = authorId
    ? `discord:${authorId}`
    : channelId
      ? `discord:channel:${channelId}`
      : null;

  if (!phone) {
    debugLog("[discord] Payload has no user or channel id. Exiting.");
    return NextResponse.json({ ok: true });
  }

  const customerName =
    author?.global_name?.trim() ||
    author?.username?.trim() ||
    "Discord User";

  const args = {
    businessId: business.id,
    businessToken: business.discordBotToken,
    phone,
    customerName,
    content,
    channelId,
    interaction,
  };

  if (!interaction) {
    // Non-interaction caller: there is no 3-second deadline, so answer inline.
    // Like the Telegram webhook, failures are swallowed so Discord does not
    // retry the same message.
    try {
      await processMessage(args);
    } catch (error) {
      console.error("[discord] Failed to process message:", error);
    }
    return NextResponse.json({ ok: true });
  }

  // Acknowledge immediately so Discord does not show "This interaction
  // failed", then finish the AI call in the background.
  after(async () => {
    try {
      await processMessage(args);
    } catch (error) {
      console.error("[discord] Background processing failed:", error);
    }
  });

  return NextResponse.json({ type: 5 });
}

function isValidDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey || !signature || !timestamp) return false;

  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody, "utf8"),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex"),
    );
  } catch {
    return false;
  }
}

type MessageArgs = {
  businessId: string;
  businessToken: string | null;
  phone: string;
  customerName: string;
  content: string;
  channelId: string | null;
  interaction: { applicationId: string; token: string } | null;
};

async function processMessage(args: MessageArgs): Promise<void> {
  await prisma.customer.upsert({
    where: {
      businessId_phone: { businessId: args.businessId, phone: args.phone },
    },
    update: {},
    create: {
      businessId: args.businessId,
      name: args.customerName,
      phone: args.phone,
    },
  });

  const result = await handleIncomingMessage({
    businessId: args.businessId,
    customerPhone: args.phone,
    message: args.content,
  });

  if (result.blocked || !result.reply) {
    debugLog(
      `[discord] Message saved, AI reply skipped (reason: ${
        result.blocked ? result.reason : "no_reply"
      })`,
    );
    // A deferred interaction cannot stay silent without spinning forever.
    if (args.interaction) {
      await sendInteractionFollowUp({
        ...args.interaction,
        content: FALLBACK_REPLY,
      });
    }
    return;
  }

  const reply = cleanReply(result.reply);
  if (!reply) return;

  if (args.interaction) {
    await sendInteractionFollowUp({ ...args.interaction, content: reply });
    return;
  }

  if (args.channelId && args.businessToken) {
    await sendChannelMessage({
      botToken: args.businessToken,
      channelId: args.channelId,
      content: reply,
    });
  }
}

/** Pull the prompt text out of a slash command or a plain message payload. */
function readMessageContent(payload: DiscordPayload): string | null {
  if (typeof payload.content === "string" && payload.content.trim()) {
    return payload.content.trim();
  }

  return readOptionContent(payload.data?.options);
}

function readOptionContent(options?: DiscordOption[]): string | null {
  if (!options) return null;

  for (const option of options) {
    if (
      (option.name === "message" ||
        option.name === "content" ||
        option.name === "prompt") &&
      typeof option.value === "string" &&
      option.value.trim()
    ) {
      return option.value.trim();
    }
  }

  // Subcommands nest their options one level deeper.
  for (const option of options) {
    const nested = readOptionContent(option.options);
    if (nested) return nested;
  }

  return null;
}

async function resolveBusiness(token: string | null, guildId: string | null) {
  if (token) {
    const byToken = await prisma.business.findFirst({
      where: { discordBotToken: token },
      select: { id: true, discordBotToken: true },
    });
    if (byToken) return byToken;
  }

  if (guildId) {
    return prisma.business.findFirst({
      where: { discordGuildId: guildId },
      select: { id: true, discordBotToken: true },
    });
  }

  return null;
}

/** Discord caps messages at 2000 characters. */
function cleanReply(reply: string): string {
  return reply
    .replace(/\[IMAGE:\s*[^\]]+?\s*\]/gi, "")
    .trim()
    .slice(0, 2000);
}

/** Post a follow-up to the interaction webhook (the deferred reply). */
async function sendInteractionFollowUp(args: {
  applicationId: string;
  token: string;
  content: string;
}): Promise<void> {
  const response = await fetch(
    `${DISCORD_API}/webhooks/${args.applicationId}/${args.token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: args.content,
        allowed_mentions: { parse: [] },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      `[discord] interaction follow-up failed (${response.status}): ${detail}`,
    );
  }
}

/** Post a normal channel message with the bot token. */
async function sendChannelMessage(args: {
  botToken: string;
  channelId: string;
  content: string;
}): Promise<void> {
  const response = await fetch(
    `${DISCORD_API}/channels/${args.channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${args.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: args.content,
        allowed_mentions: { parse: [] },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      `[discord] sendMessage failed (${response.status}): ${detail}`,
    );
  }
}
