import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/chat-engine";

const GRAPH_API = "https://graph.facebook.com/v21.0";

type WhatsAppMessage = {
  from?: string;
  type?: string;
  text?: { body?: string };
};

type WhatsAppValue = {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{
    profile?: { name?: string };
    wa_id?: string;
  }>;
  messages?: WhatsAppMessage[];
};

type WhatsAppPayload = {
  entry?: Array<{
    changes?: Array<{ value?: WhatsAppValue }>;
  }>;
};

type IncomingMessage = {
  phoneNumberId: string;
  from: string;
  name: string;
  text: string;
};

/**
 * GET /api/whatsapp/webhook
 *
 * Meta's webhook verification handshake. The verify token must match one
 * business's stored `whatsappVerifyToken`; the response body is the raw
 * `hub.challenge` value, exactly as Meta expects.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const verifyToken = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode !== "subscribe" || !verifyToken || challenge === null) {
    return new Response("Forbidden", { status: 403 });
  }

  const business = await prisma.business.findFirst({
    where: { whatsappVerifyToken: verifyToken },
    select: { id: true },
  });

  if (!business) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * POST /api/whatsapp/webhook
 *
 * Incoming WhatsApp Cloud API events. Returns 200 immediately so Meta does
 * not retry, then processes text messages in the background: resolve the
 * business by phone number id, run the normal chat engine, and send the reply
 * through the Cloud API with the business's access token.
 */
export async function POST(request: Request) {
  let payload: WhatsAppPayload;
  try {
    payload = (await request.json()) as WhatsAppPayload;
  } catch {
    return new Response("OK", { status: 200 });
  }

  const messages = collectMessages(payload);

  if (messages.length > 0) {
    after(async () => {
      for (const message of messages) {
        try {
          await processMessage(message);
        } catch (error) {
          console.error("[whatsapp] Failed to process message:", error);
        }
      }
    });
  }

  return new Response("OK", { status: 200 });
}

function collectMessages(payload: WhatsAppPayload): IncomingMessage[] {
  const collected: IncomingMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!value || !phoneNumberId) continue;

      const contactName = value.contacts?.[0]?.profile?.name?.trim();

      for (const message of value.messages ?? []) {
        if (message.type !== "text") continue;

        const from = message.from?.trim();
        const text = message.text?.body?.trim();
        if (!from || !text) continue;

        collected.push({
          phoneNumberId,
          from,
          name: contactName || from,
          text,
        });
      }
    }
  }

  return collected;
}

async function processMessage(message: IncomingMessage): Promise<void> {
  const business = await prisma.business.findFirst({
    where: { whatsappPhoneNumberId: message.phoneNumberId },
    select: { id: true, whatsappAccessToken: true },
  });

  if (!business) {
    console.log(
      "[whatsapp] No business found for phone number id. Exiting.",
    );
    return;
  }

  if (!business.whatsappAccessToken) {
    console.log("[whatsapp] Business has no access token. Exiting.");
    return;
  }

  await prisma.customer.upsert({
    where: {
      businessId_phone: { businessId: business.id, phone: message.from },
    },
    update: {},
    create: {
      businessId: business.id,
      name: message.name,
      phone: message.from,
    },
  });

  const result = await handleIncomingMessage({
    businessId: business.id,
    customerPhone: message.from,
    message: message.text,
  });

  if (result.blocked || !result.reply) {
    console.log(
      `[whatsapp] Message saved, AI reply skipped (reason: ${
        result.blocked ? result.reason : "no_reply"
      })`,
    );
    return;
  }

  const reply = cleanReply(result.reply);
  if (!reply) return;

  await sendWhatsAppText({
    phoneNumberId: message.phoneNumberId,
    accessToken: business.whatsappAccessToken,
    to: message.from,
    text: reply,
  });
}

/** WhatsApp text messages are capped at 4096 characters. */
function cleanReply(reply: string): string {
  return reply
    .replace(/\[IMAGE:\s*[^\]]+?\s*\]/gi, "")
    .trim()
    .slice(0, 4096);
}

async function sendWhatsAppText(args: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}): Promise<void> {
  const response = await fetch(
    `${GRAPH_API}/${args.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: args.to,
        type: "text",
        text: { preview_url: false, body: args.text },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      `[whatsapp] sendMessage failed (${response.status}): ${detail}`,
    );
  }
}
