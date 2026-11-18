import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHANNEL_DEFINITIONS,
  CHANNEL_KEYS,
  CHANNELS_HUB_PATH,
  DISCONNECTED_WHATSAPP_SESSION,
  botChannelStatusLabel,
  channelActionLabel,
  channelCreditCost,
  channelCreditLabel,
  getChannelDefinition,
  isChannelKey,
  normalizeWhatsAppSession,
  telegramBotLink,
  whatsappSessionViewFromRow,
  whatsappStatusLabel,
  whatsappStatusTone,
  WEB_CHAT_STATUS_LABEL,
} from "../lib/channels";
import { REPLY_CREDIT_COSTS } from "../lib/plans";
import { isOwnerOnlyPath } from "../lib/team";
import { webChatEmbedCode, webChatLink } from "../lib/web-chat";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

test("the hub covers exactly the four channels, in card order", () => {
  assert.deepEqual([...CHANNEL_KEYS], [
    "whatsapp",
    "telegram",
    "discord",
    "web_chat",
  ]);
  assert.deepEqual(
    CHANNEL_DEFINITIONS.map((channel) => channel.key),
    [...CHANNEL_KEYS],
  );

  assert.equal(CHANNELS_HUB_PATH, "/channels");

  assert.equal(isChannelKey("whatsapp"), true);
  assert.equal(isChannelKey("web_chat"), true);
  assert.equal(isChannelKey("WHATSAPP"), false);
  assert.equal(isChannelKey("instagram"), false);
  assert.equal(isChannelKey(undefined), false);

  assert.throws(() => getChannelDefinition("instagram" as never));
});

test("credit pills quote the live credit economy", () => {
  assert.equal(channelCreditCost("whatsapp"), REPLY_CREDIT_COSTS.whatsapp);
  assert.equal(channelCreditCost("telegram"), REPLY_CREDIT_COSTS.standard);
  assert.equal(channelCreditCost("discord"), REPLY_CREDIT_COSTS.standard);
  assert.equal(channelCreditCost("web_chat"), REPLY_CREDIT_COSTS.standard);

  assert.equal(channelCreditLabel("whatsapp"), "80 credits / AI reply");
  assert.equal(channelCreditLabel("telegram"), "5 credits / AI reply");
  assert.equal(channelCreditLabel("discord"), "5 credits / AI reply");
  assert.equal(channelCreditLabel("web_chat"), "5 credits / AI reply");

  // WhatsApp pairing is the owner's decision; the other three are shared
  // screens (Web Chat has no credential at all).
  assert.equal(getChannelDefinition("whatsapp").ownerOnly, true);
  assert.equal(getChannelDefinition("telegram").ownerOnly, true);
  assert.equal(getChannelDefinition("discord").ownerOnly, true);
  assert.equal(getChannelDefinition("web_chat").ownerOnly, false);
});

test("the primary button says Connect, Manage or Customize", () => {
  assert.equal(channelActionLabel("whatsapp", false), "Connect");
  assert.equal(channelActionLabel("whatsapp", true), "Manage");
  assert.equal(channelActionLabel("telegram", false), "Connect");
  assert.equal(channelActionLabel("telegram", true), "Manage");
  assert.equal(channelActionLabel("discord", false), "Connect");
  assert.equal(channelActionLabel("discord", true), "Manage");
  // Web Chat is always live, so there is nothing to connect.
  assert.equal(channelActionLabel("web_chat", false), "Customize");
  assert.equal(channelActionLabel("web_chat", true), "Customize");
});

test("WhatsApp's badge names the live pairing state", () => {
  assert.equal(whatsappStatusLabel("CONNECTED"), "Connected");
  assert.equal(whatsappStatusLabel("QR_READY"), "QR Ready");
  assert.equal(whatsappStatusLabel("CONNECTING"), "Starting");
  assert.equal(whatsappStatusLabel("DISCONNECTED"), "Disconnected");
  // A CONNECTING row the worker never answered is not "Starting" any more.
  assert.equal(whatsappStatusLabel("CONNECTING", true), "No response");
  // A stale flag cannot relabel a settled session.
  assert.equal(whatsappStatusLabel("CONNECTED", true), "Connected");

  assert.equal(whatsappStatusTone("CONNECTED"), "positive");
  assert.equal(whatsappStatusTone("QR_READY"), "waiting");
  assert.equal(whatsappStatusTone("CONNECTING"), "waiting");
  assert.equal(whatsappStatusTone("CONNECTING", true), "problem");
  assert.equal(whatsappStatusTone("DISCONNECTED"), "neutral");

  assert.equal(botChannelStatusLabel(true), "Connected");
  assert.equal(botChannelStatusLabel(false), "Disconnected");
  assert.equal(WEB_CHAT_STATUS_LABEL, "Active");
});

const NOW = Date.parse("2026-11-18T12:00:00.000Z");

test("a session payload is narrowed, never trusted", () => {
  assert.deepEqual(normalizeWhatsAppSession(null), DISCONNECTED_WHATSAPP_SESSION);

  // Garbage in the wire shape cannot claim a connection.
  assert.deepEqual(
    normalizeWhatsAppSession({
      status: "PAIRED_ISH",
      qrCode: 42,
      phoneNumber: undefined,
      updatedAt: 7,
      stalled: "yes",
    }),
    DISCONNECTED_WHATSAPP_SESSION,
  );

  assert.deepEqual(
    normalizeWhatsAppSession({
      status: "QR_READY",
      qrCode: "2@abc",
      phoneNumber: null,
      updatedAt: "2026-11-18T11:59:59.000Z",
      stalled: false,
    }),
    {
      status: "QR_READY",
      qrCode: "2@abc",
      phoneNumber: null,
      updatedAt: "2026-11-18T11:59:59.000Z",
      stalled: false,
    },
  );
});

test("the server view applies the same 45-second pairing rule", () => {
  // No row at all: the tenant never pressed Connect.
  assert.deepEqual(whatsappSessionViewFromRow(null), DISCONNECTED_WHATSAPP_SESSION);

  const fresh = whatsappSessionViewFromRow(
    {
      status: "CONNECTING",
      qrCode: null,
      phoneNumber: null,
      updatedAt: new Date(NOW - 5_000),
    },
    NOW,
  );
  assert.equal(fresh.stalled, false);
  assert.equal(fresh.updatedAt, new Date(NOW - 5_000).toISOString());

  const stale = whatsappSessionViewFromRow(
    {
      status: "CONNECTING",
      qrCode: null,
      phoneNumber: null,
      updatedAt: new Date(NOW - 46_000),
    },
    NOW,
  );
  assert.equal(stale.stalled, true);

  // A QR the owner can act on is never "stalled", however old the row is.
  const withQr = whatsappSessionViewFromRow(
    {
      status: "CONNECTING",
      qrCode: "2@abc",
      phoneNumber: null,
      updatedAt: new Date(NOW - 600_000),
    },
    NOW,
  );
  assert.equal(withQr.stalled, false);

  // A stored status the app does not know reads as disconnected.
  const unknown = whatsappSessionViewFromRow(
    {
      status: "PAIRED",
      qrCode: null,
      phoneNumber: "+2348012345678",
      updatedAt: new Date(NOW),
    },
    NOW,
  );
  assert.equal(unknown.status, "DISCONNECTED");
});

test("the Web Chat snippet and the bot link are derived, not typed", () => {
  assert.equal(telegramBotLink(null), null);
  assert.equal(telegramBotLink("@collybot"), "https://t.me/collybot");
  assert.equal(telegramBotLink("collybot"), "https://t.me/collybot");

  const link = webChatLink("biz-1");
  assert.equal(link, "https://colly.com.ng/chat/biz-1");
  const embed = webChatEmbedCode("biz-1");
  assert.ok(embed.startsWith("<iframe"));
  assert.ok(embed.includes(`src="${link}"`));
  assert.ok(embed.endsWith("</iframe>"));
});

test("/channels is a server page that loads the tenant's real statuses", () => {
  const page = source("app/(dashboard)/channels/page.tsx");

  // A Server Component: no client directive, session read on the server.
  assert.doesNotMatch(page, /^"use client";/);
  assert.match(page, /await connection\(\)/);
  assert.match(page, /requireAuth\(\)/);
  assert.match(page, /prisma\.whatsAppSession\.findUnique/);
  assert.match(page, /telegramBotToken: true/);
  assert.match(page, /discordBotToken: true/);
  // Only the presence of a token crosses to the browser, never the token.
  assert.doesNotMatch(page, /telegramBotToken: business\.telegramBotToken/);
  assert.doesNotMatch(page, /discordBotToken: business\.discordBotToken/);
  assert.match(page, /whatsappSessionViewFromRow\(session\)/);
  assert.match(page, /isOwner=\{user\.role === "OWNER"\}/);
  assert.match(page, /<ChannelsHub/);
});

test("the hub is a 2x2 grid of surface cards with progressive disclosure", () => {
  const hub = source("components/channels/channels-hub.tsx");
  const card = source("components/channels/channel-card.tsx");

  assert.match(hub, /^"use client";/);
  assert.match(hub, /grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2/);
  for (const key of ["whatsapp", "telegram", "discord", "web_chat"]) {
    assert.ok(hub.includes(`"${key}"`), `${key} has a card`);
  }
  // Credit pills come from the shared vocabulary, not typed strings.
  assert.match(hub, /channelCreditLabel\("whatsapp"\)/);
  assert.match(hub, /channelCreditLabel\("telegram"\)/);
  assert.match(hub, /channelCreditLabel\("discord"\)/);
  assert.match(hub, /channelCreditLabel\("web_chat"\)/);

  assert.match(card, /surface-card/);
  assert.match(card, /surface-card-interactive/);
  assert.match(card, /duration-250/);
  assert.match(card, /aria-expanded=\{expanded\}/);
  assert.match(card, /aria-controls=\{panelId\}/);
  // The setup inputs exist only while the card is open.
  assert.match(card, /\{expanded \? \(/);
});

test("owner-only setup stays owner-only inside the hub", () => {
  const hub = source("components/channels/channels-hub.tsx");
  const panels = [
    source("components/channels/whatsapp-panel.tsx"),
    source("components/channels/telegram-panel.tsx"),
    source("components/channels/discord-panel.tsx"),
  ];

  // A staff session never polls the owner-only pairing endpoint.
  assert.match(hub, /enabled: isOwner/);
  // The CTA says so instead of offering an action the API would reject.
  assert.match(hub, /if \(definition\.ownerOnly && !isOwner\) return "Owner only";/);

  for (const panel of panels) {
    assert.match(panel, /if \(!isOwner\)/);
    assert.match(panel, /managed by the business owner/);
  }

  // The APIs behind the panels remain the real gate (the proxy skips /api).
  assert.match(
    source("app/api/whatsapp/session/route.ts"),
    /requireOwnerApi\(\)/,
  );
  assert.match(
    source("app/api/telegram/connect/route.ts"),
    /requireOwnerApi\(\)/,
  );
  assert.match(source("app/api/discord/actions.ts"), /user\.role !== "OWNER"/);
});

test("each setup panel reuses the existing channel API", () => {
  const telegram = source("components/channels/telegram-panel.tsx");
  const discord = source("components/channels/discord-panel.tsx");
  const webChat = source("components/channels/web-chat-panel.tsx");
  const whatsapp = source("components/channels/whatsapp-panel.tsx");

  // Telegram: the same connect route and the same /startowner handoff step.
  assert.match(telegram, /\/api\/telegram\/connect/);
  assert.match(telegram, /\/startowner/);
  assert.match(telegram, /Verify connection/);

  // Discord: the same owner-only Server Action the AI Line page calls.
  assert.match(discord, /saveDiscordBotToken/);

  // Web Chat: one embed snippet, copy button and the customization screen.
  assert.match(webChat, /webChatEmbedCode/);
  assert.match(webChat, /Copy embed code/);
  assert.match(webChat, /\/settings\/web-chat/);

  // WhatsApp: the QR lives in the shared panel, not a second copy.
  assert.match(whatsapp, /QRCodeCanvas/);
});

test("the sidebar links Channels once and leaves no WhatsApp row behind", () => {
  const sidebar = source("components/dashboard/sidebar.tsx");

  assert.match(
    sidebar,
    /label: "Channels", href: "\/channels", icon: Cable/,
  );
  assert.doesNotMatch(sidebar, /href: "\/settings\/whatsapp"/);

  // Staff may read the hub; pairing inside it is still owner-only.
  assert.equal(isOwnerOnlyPath("/channels"), false);
  assert.equal(isOwnerOnlyPath("/channels/whatsapp"), false);

  // Every old entry point now points at the hub.
  assert.match(
    source("app/(dashboard)/settings/page.tsx"),
    /href="\/channels"/,
  );
  assert.match(
    source("app/(dashboard)/settings/ai-line/page.tsx"),
    /href="\/channels"/,
  );
  assert.match(source("app/(dashboard)/ai/page.tsx"), /href="\/channels"/);
  assert.match(
    source("components/dashboard/dashboard-shell.tsx"),
    /href="\/channels"/,
  );

  // The old pairing URL still works (bookmarks), on the same implementation.
  assert.match(
    source("app/(dashboard)/settings/whatsapp/page.tsx"),
    /useWhatsAppSession/,
  );
});

