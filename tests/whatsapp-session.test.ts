import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildWhatsAppSystemPrompt,
  getRandomDelay,
  normalizeWhatsAppTone,
  type WhatsAppBusinessProfile,
} from "../lib/chat-engine";
import {
  extractWhatsAppText,
  handleWhatsAppUpsert,
  isGroupOrBroadcastJid,
  isWhatsAppSessionState,
  replyToWhatsAppCustomer,
  resolveWhatsAppBusinessId,
  serializeWhatsAppSession,
  whatsappPhoneFromJid,
  type WhatsAppReplyFn,
  type WhatsAppSocket,
} from "../lib/whatsapp-session";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Every .ts/.tsx file under a directory, as repo-relative paths. */
function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    },
  );
}

/** A socket that records what the adapter sends. */
function fakeSocket(): WhatsAppSocket & {
  sent: { jid: string; text: string }[];
} {
  const sent: { jid: string; text: string }[] = [];

  return {
    sent,
    sendMessage: async (jid, content) => {
      sent.push({ jid, text: content.text });
    },
  };
}

/** A reply source that records the call and answers with a fixed line. */
function fakeReply(text = "Yes, we have it in stock.") {
  const calls: { businessId: string; customerPhone: string; text: string }[] =
    [];

  const reply: WhatsAppReplyFn = async (input) => {
    calls.push(input);
    return text;
  };

  return { calls, reply };
}

const shop: WhatsAppBusinessProfile = {
  name: "ABC Electronics",
  description: "Phones, chargers and small appliances.",
  businessHours: "Mon-Fri 9am-6pm",
  paymentInstructions: "GTBank 0123456789, ABC Electronics",
  industry: "RETAIL",
  tone: "friendly",
};

test("a WhatsApp JID becomes the digits a customer is keyed by", () => {
  assert.equal(whatsappPhoneFromJid("2348012345678@s.whatsapp.net"), "2348012345678");
  // A device JID carries a `:device` suffix before the server part.
  assert.equal(whatsappPhoneFromJid("2348012345678:12@s.whatsapp.net"), "2348012345678");
  assert.equal(whatsappPhoneFromJid(""), "");
});

test("groups, broadcast lists and the status feed are never answered", () => {
  assert.equal(isGroupOrBroadcastJid("120363012345678901@g.us"), true);
  assert.equal(isGroupOrBroadcastJid("status@broadcast"), true);
  assert.equal(isGroupOrBroadcastJid("1234567890@broadcast"), true);
  assert.equal(isGroupOrBroadcastJid("120363012345678901@newsletter"), true);

  // A one-to-one chat is the only thing the AI may answer.
  assert.equal(isGroupOrBroadcastJid("2348012345678@s.whatsapp.net"), false);
});

test("text is read from a plain message, an extended text and an image caption", () => {
  assert.equal(extractWhatsAppText({ conversation: "  How much is the charger? " }), "How much is the charger?");
  assert.equal(
    extractWhatsAppText({ extendedTextMessage: { text: "Do you deliver to Enugu?" } }),
    "Do you deliver to Enugu?",
  );
  assert.equal(
    extractWhatsAppText({ imageMessage: { caption: "This one" } }),
    "This one",
  );

  // Nothing the model can read: no text, an empty body, an uncaptioned picture.
  assert.equal(extractWhatsAppText(null), "");
  assert.equal(extractWhatsAppText(undefined), "");
  assert.equal(extractWhatsAppText({ conversation: "   " }), "");
  assert.equal(extractWhatsAppText({ imageMessage: {} }), "");
});

test("an inbound text is answered once, in its own chat", async () => {
  const sock = fakeSocket();
  const { calls, reply } = fakeReply();

  await handleWhatsAppUpsert({
    sock,
    businessId: "biz-1",
    update: {
      type: "notify",
      messages: [
        {
          key: { remoteJid: "2348012345678@s.whatsapp.net", fromMe: false },
          message: { conversation: "How much is the charger?" },
        },
      ],
    },
    reply,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    businessId: "biz-1",
    // The database key is the bare number, not the JID.
    customerPhone: "2348012345678",
    text: "How much is the charger?",
  });

  // Delivery goes back to the JID the customer actually wrote from.
  assert.deepEqual(sock.sent, [
    { jid: "2348012345678@s.whatsapp.net", text: "Yes, we have it in stock." },
  ]);
});

test("our own messages, groups and silent updates are skipped", async () => {
  const sock = fakeSocket();
  const { calls, reply } = fakeReply();

  await handleWhatsAppUpsert({
    sock,
    businessId: "biz-1",
    update: {
      type: "notify",
      messages: [
        // A reply the owner sent from the phone.
        {
          key: { remoteJid: "2348012345678@s.whatsapp.net", fromMe: true },
          message: { conversation: "I will answer this one." },
        },
        // A group chat.
        {
          key: { remoteJid: "120363012345678901@g.us", fromMe: false },
          message: { conversation: "Anybody there?" },
        },
        // The status feed.
        {
          key: { remoteJid: "status@broadcast", fromMe: false },
          message: { conversation: "Promo today" },
        },
        // An uncaptioned receipt picture: the vision pipeline is not wired here.
        {
          key: { remoteJid: "2348012345678@s.whatsapp.net", fromMe: false },
          message: { imageMessage: {} },
        },
      ],
    },
    reply,
  });

  assert.equal(calls.length, 0);
  assert.deepEqual(sock.sent, []);
});

test("a paused conversation sends nothing", async () => {
  const sock = fakeSocket();
  const silent: WhatsAppReplyFn = async () => null;

  const delivered = await replyToWhatsAppCustomer({
    sock,
    businessId: "biz-1",
    jid: "2348012345678@s.whatsapp.net",
    text: "Hello",
    reply: silent,
  });

  assert.equal(delivered, null);
  assert.deepEqual(sock.sent, []);
});

test("one failing message cannot silence the rest of the batch", async () => {
  const sock = fakeSocket();
  const seen: string[] = [];

  const reply: WhatsAppReplyFn = async ({ text }) => {
    seen.push(text);
    if (text === "boom") throw new Error("provider down");
    return "Sure, we can help with that.";
  };

  await handleWhatsAppUpsert({
    sock,
    businessId: "biz-1",
    update: {
      type: "notify",
      messages: [
        {
          key: { remoteJid: "2348000000001@s.whatsapp.net", fromMe: false },
          message: { conversation: "boom" },
        },
        {
          key: { remoteJid: "2348000000002@s.whatsapp.net", fromMe: false },
          message: { conversation: "Do you have the 2GB charger?" },
        },
      ],
    },
    reply,
  });

  assert.deepEqual(seen, ["boom", "Do you have the 2GB charger?"]);
  assert.equal(sock.sent.length, 1);
  assert.equal(sock.sent[0].jid, "2348000000002@s.whatsapp.net");
});

test("the typing pause is clamped and adds real time", async () => {
  // A zero range resolves without waiting, which keeps this test fast. The
  // bound is generous because the suite runs several files at once.
  const start = Date.now();
  await getRandomDelay(0, 0);
  assert.ok(Date.now() - start < 1_000);

  // A reversed range is read as (25, 40), not as an instant pause.
  await getRandomDelay(40, 25);
  assert.ok(true, "a reversed range must not hang");

  const measured = Date.now();
  await getRandomDelay(25, 40);
  const elapsed = Date.now() - measured;
  assert.ok(elapsed >= 24, `expected a real pause, got ${elapsed}ms`);

  // A negative bound cannot produce a negative timer.
  await getRandomDelay(-100, 0);
});

test("tones: formal, friendly and pidgin_friendly, with a friendly fallback", () => {
  assert.equal(normalizeWhatsAppTone("formal"), "formal");
  assert.equal(normalizeWhatsAppTone("friendly"), "friendly");
  assert.equal(normalizeWhatsAppTone("pidgin_friendly"), "pidgin_friendly");
  assert.equal(normalizeWhatsAppTone("Pidgin-Friendly"), "pidgin_friendly");
  assert.equal(normalizeWhatsAppTone("pidgin"), "pidgin_friendly");
  assert.equal(normalizeWhatsAppTone("shouty"), "friendly");
  assert.equal(normalizeWhatsAppTone(null), "friendly");
  assert.equal(normalizeWhatsAppTone(undefined), "friendly");
});

test("the prompt is Naira-first, WhatsApp-sized and plain text", () => {
  const prompt = buildWhatsAppSystemPrompt(shop);

  assert.match(prompt, /ABC Electronics/);
  // The naira sign is the escaped character, exactly like formatNaira().
  assert.ok(prompt.includes("\u20A6"), "prices must be quoted in Naira");
  assert.match(prompt, /Never quote dollars/);
  assert.match(prompt, /N15,000/, "the wrong Naira format is called out");
  assert.match(prompt, /at most 3 short sentences/);
  assert.match(prompt, /plain text only/i);
  assert.match(prompt, /Never reveal exact quantities/);
  assert.match(prompt, /my boss/);
  assert.match(prompt, /my oga/);

  // Tenant fields the model needs are carried through.
  assert.match(prompt, /Phones, chargers and small appliances\./);
  assert.match(prompt, /Mon-Fri 9am-6pm/);
  assert.match(prompt, /GTBank 0123456789/);

  // The vertical and the tone come last.
  assert.match(prompt, /RETAIL MODE/);
  assert.match(prompt, /warmly and casually/);
});

test("the industry persona and the tone setting are actually obeyed", () => {
  const hotel = buildWhatsAppSystemPrompt(
    { ...shop, industry: "HOTEL", tone: "formal" },
  );

  // The same persona the metered engine appends: both dates before a booking.
  assert.match(hotel, /HOTEL MODE/);
  assert.match(hotel, /Check-in Date and Check-out Date/);
  assert.match(hotel, /professional Nigerian English/);
  assert.doesNotMatch(hotel, /RETAIL MODE/);

  const services = buildWhatsAppSystemPrompt({
    ...shop,
    industry: "SERVICES",
    tone: "pidgin_friendly",
  });

  assert.match(services, /SERVICES MODE/);
  assert.match(services, /Pidgin/);

  // A stored value outside INDUSTRIES is read as the schema default, so a
  // hand-edited row cannot switch on a persona nobody reviewed.
  const unknown = buildWhatsAppSystemPrompt({
    ...shop,
    industry: "SPACESHIPS",
    tone: "shouty",
  });

  assert.match(unknown, /RETAIL MODE/);
  assert.match(unknown, /warmly and casually/);
});


test("the adapter stays socket-agnostic and only the worker imports baileys", () => {
  const adapter = source("lib/whatsapp-session.ts");

  // The socket is injected, so this library works with a Baileys socket, a
  // test double or any future transport.
  assert.doesNotMatch(adapter, /from\s+["']@whiskeysockets\/baileys["']/);
  assert.doesNotMatch(adapter, /require\(["']@whiskeysockets\/baileys["']\)/);
  assert.match(adapter, /export type WhatsAppSocket/);
  assert.match(adapter, /sendMessage: \(jid: string, content: \{ text: string \}\)/);

  // Baileys IS a dependency now, but only for the standalone worker: a
  // long-lived socket must never be created inside a Next.js request scope.
  const importsBaileys =
    /(?:from\s+|require\()["']@whiskeysockets\/baileys["']/;

  const offenders = ["app", "lib", "components"]
    .flatMap((dir) => sourceFiles(dir))
    .filter((file) => importsBaileys.test(source(file)));

  assert.deepEqual(offenders, []);
  assert.match(
    source("workers/whatsapp-worker.ts"),
    importsBaileys,
    "the worker is the one process that owns the socket",
  );
});

test("the listener covers upserts and connection state", () => {
  const adapter = source("lib/whatsapp-session.ts");

  assert.match(adapter, /sock\.ev\?\.on\("messages\.upsert"/);
  assert.match(adapter, /sock\.ev\?\.on\("connection\.update"/);
  assert.match(adapter, /type !== "notify"/);
  // History sync must not trigger a burst of replies.
  assert.match(adapter, /update\.type !== "notify"/);
});

test("the reply loop is the metered engine, not a free side path", () => {
  const adapter = source("lib/whatsapp-session.ts");

  // Both messages (customer + bot) are written by the engine, which is also
  // where credits are charged and a human takeover is honoured.
  assert.match(adapter, /handleIncomingMessage\(\{/);
  assert.match(adapter, /typingJitter: true/);
  assert.match(adapter, /if \(!aiResponse\) return null/);
  assert.match(adapter, /await sock\.sendMessage\(jid, \{ text: aiResponse \}\)/);
});

test("the typing jitter is opt-in and sits before the model call", () => {
  const engine = source("lib/chat-engine.ts");

  assert.match(engine, /typingJitter = false/);
  assert.match(engine, /export async function getRandomDelay/);
  assert.match(engine, /if \(typingJitter\) \{\s*await getRandomDelay\(\);/);

  // The pause comes after every free gate, so a paused or out-of-credit chat
  // answers immediately, and before the credit reservation / provider call.
  const jitter = engine.indexOf("if (typingJitter)");
  assert.ok(jitter > 0);
  assert.ok(
    engine.indexOf("chargeAiReply(businessId, channel ?? business.channel)") >
      jitter,
  );
});

test("generateAiReply asks the chain at 0.7 and never throws at its caller", () => {
  const engine = source("lib/chat-engine.ts");
  const ai = source("lib/ai.ts");

  assert.match(engine, /export async function generateAiReply\(/);
  assert.match(engine, /business\.findUniqueOrThrow/);
  assert.match(engine, /temperature: 0\.7/);
  // A missing tenant or a provider failure still returns sendable text.
  assert.match(engine, /return FALLBACK_REPLY;/);

  // The temperature knob is passed per request, so every existing call keeps
  // the provider default and an empty body is unchanged.
  assert.match(ai, /temperature\?: number/);
  assert.match(ai, /temperature: options\.temperature/);
});

test("the whatsapp session migration is re-runnable", () => {
  const sql = source(
    "prisma/migrations/20261117000000_add_whatsapp_session/migration.sql",
  );

  // `prisma migrate deploy` runs on every build, so a build can meet a
  // database that already has the table or the enum.
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "WhatsAppSession"/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS/);
  assert.match(sql, /pg_type/);
  assert.match(sql, /pg_constraint/);
});


// ---------------------------------------------------------------------------
// The status payload behind Settings → WhatsApp
// ---------------------------------------------------------------------------

test("a missing or unknown session row reads as disconnected", () => {
  assert.deepEqual(serializeWhatsAppSession(null), {
    status: "DISCONNECTED",
    qrCode: null,
    phoneNumber: null,
  });

  assert.deepEqual(
    serializeWhatsAppSession({
      status: "QR_READY",
      qrCode: "2@abc123",
      phoneNumber: null,
    }),
    { status: "QR_READY", qrCode: "2@abc123", phoneNumber: null },
  );

  // A hand-edited column must not reach the UI as a fifth state.
  assert.deepEqual(
    serializeWhatsAppSession({
      status: "LOGGING_OUT",
      qrCode: null,
      phoneNumber: "2348012345678",
    }),
    {
      status: "DISCONNECTED",
      qrCode: null,
      phoneNumber: "2348012345678",
    },
  );

  assert.equal(isWhatsAppSessionState("CONNECTED"), true);
  assert.equal(isWhatsAppSessionState("DISCONNECTED"), true);
  assert.equal(isWhatsAppSessionState("BOT"), false);
  assert.equal(isWhatsAppSessionState(null), false);
});

test("a supplied business id can only repeat the session's own tenant", () => {
  assert.equal(resolveWhatsAppBusinessId("biz-1", undefined), "biz-1");
  assert.equal(resolveWhatsAppBusinessId("biz-1", null), "biz-1");
  assert.equal(resolveWhatsAppBusinessId("biz-1", "   "), "biz-1");
  assert.equal(resolveWhatsAppBusinessId("biz-1", 42), "biz-1");
  assert.equal(resolveWhatsAppBusinessId("biz-1", " biz-1 "), "biz-1");

  // Another tenant's id is refused outright, never redirected.
  assert.equal(resolveWhatsAppBusinessId("biz-1", "biz-2"), null);
});

test("a WhatsApp turn is gated and charged at the WhatsApp rate", () => {
  const adapter = source("lib/whatsapp-session.ts");
  const engine = source("lib/chat-engine.ts");
  const guards = source("lib/auth-guards.ts");

  // The adapter names the channel, the engine forwards it to both the wallet
  // check and the debit, and lib/auth-guards prices the override.
  assert.match(adapter, /channel: "WHATSAPP"/);
  assert.match(engine, /requireAiEnabled\(businessId, channel\)/);
  assert.match(
    engine,
    /chargeAiReply\(businessId, channel \?\? business\.channel\)/,
  );
  assert.match(
    guards,
    /getAiReplyCreditCost\(channel \?\? business\.channel\)/,
  );
});

