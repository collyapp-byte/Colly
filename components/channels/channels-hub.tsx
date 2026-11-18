"use client";

import { useState } from "react";
import { Globe, MessageSquare, Send, Smartphone } from "lucide-react";

import { ChannelCard } from "./channel-card";
import { DiscordPanel } from "./discord-panel";
import { TelegramPanel } from "./telegram-panel";
import { WebChatPanel } from "./web-chat-panel";
import { WhatsAppPanel } from "./whatsapp-panel";
import { useWhatsAppSession } from "./use-whatsapp-session";
import type { ChannelBusinessPatch, ChannelBusinessView } from "./types";
import {
  botChannelStatusLabel,
  channelActionLabel,
  channelCreditCost,
  channelCreditLabel,
  getChannelDefinition,
  WEB_CHAT_STATUS_LABEL,
  whatsappStatusLabel,
  whatsappStatusTone,
  type ChannelKey,
  type WhatsAppSessionView,
} from "@/lib/channels";

/**
 * The unified Channels hub: four cards, one open at a time.
 *
 * Each card is scannable at rest (icon, live status, one line, credit cost) and
 * reveals that channel's setup inputs only when it is opened — no walls of
 * instructions on first paint. WhatsApp keeps its live pairing state here (the
 * hook polls `/api/whatsapp/session`), so its badge updates without a reload.
 *
 * Owner-only work stays owner-only: a staff account sees the status but every
 * setup panel renders a "managed by the owner" note, and the APIs behind them
 * answer 403 regardless (the proxy skips `/api`).
 */

export type ChannelsHubProps = {
  business: ChannelBusinessView;
  whatsappSession: WhatsAppSessionView;
  isOwner: boolean;
  /** Card to open on first paint (`/channels?channel=telegram`). */
  initialChannel?: ChannelKey | null;
};

function formatPhone(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("+") ? value : `+${value}`;
}

export function ChannelsHub({
  business: initialBusiness,
  whatsappSession,
  isOwner,
  initialChannel = null,
}: ChannelsHubProps) {
  const [business, setBusiness] = useState(initialBusiness);
  const [openChannel, setOpenChannel] = useState<ChannelKey | null>(
    initialChannel,
  );

  const whatsapp = useWhatsAppSession(whatsappSession, { enabled: isOwner });

  function applyPatch(patch: ChannelBusinessPatch) {
    setBusiness((current) => ({ ...current, ...patch }));
  }

  function toggle(channel: ChannelKey) {
    setOpenChannel((current) => (current === channel ? null : channel));
  }

  /**
   * A staff account may open a card, but never change it. The label says so
   * instead of offering an action the API would reject.
   */
  function actionFor(channel: ChannelKey, connected: boolean): string {
    const definition = getChannelDefinition(channel);
    if (definition.ownerOnly && !isOwner) return "Owner only";
    return channelActionLabel(channel, connected);
  }

  const whatsappStatus = whatsapp.session?.status ?? "DISCONNECTED";
  const whatsappStalled = whatsapp.session?.stalled === true;
  const whatsappConnected = whatsappStatus === "CONNECTED";

  const telegramConnected = business.telegramConnected;
  const discordConnected = business.discordConnected;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="font-display text-2xl text-main sm:text-3xl">Channels</h1>
      <p className="mt-1 text-sm text-muted">
        Every way a customer can reach your AI, in one place. Connect a channel
        once and the assistant answers there with the same catalogue, FAQs and
        tone.
      </p>

      {!isOwner && (
        <p className="surface-panel mt-4 p-3 text-xs leading-relaxed text-muted">
          You are signed in as staff. You can see how each channel is doing and
          reply from the inbox; connecting or disconnecting one stays with the
          business owner.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
        {/* WHATSAPP */}
        <ChannelCard
          id="whatsapp"
          title={getChannelDefinition("whatsapp").label}
          icon={Smartphone}
          description={getChannelDefinition("whatsapp").description}
          statusLabel={whatsappStatusLabel(whatsappStatus, whatsappStalled)}
          statusTone={whatsappStatusTone(whatsappStatus, whatsappStalled)}
          statusDetail={
            whatsappConnected
              ? formatPhone(whatsapp.session?.phoneNumber ?? null)
              : null
          }
          creditLabel={channelCreditLabel("whatsapp")}
          actionLabel={actionFor("whatsapp", whatsappConnected)}
          expanded={openChannel === "whatsapp"}
          onToggle={() => toggle("whatsapp")}
          locked={!isOwner}
          lockedMessage="Only the business owner can pair or disconnect the WhatsApp line."
        >
          <WhatsAppPanel state={whatsapp} isOwner={isOwner} />
        </ChannelCard>

        {/* TELEGRAM */}
        <ChannelCard
          id="telegram"
          title={getChannelDefinition("telegram").label}
          icon={Send}
          description={getChannelDefinition("telegram").description}
          statusLabel={botChannelStatusLabel(telegramConnected)}
          statusTone={telegramConnected ? "positive" : "neutral"}
          statusDetail={
            telegramConnected && business.telegramBotUsername
              ? `@${business.telegramBotUsername.replace(/^@/, "")}`
              : null
          }
          creditLabel={channelCreditLabel("telegram")}
          actionLabel={actionFor("telegram", telegramConnected)}
          expanded={openChannel === "telegram"}
          onToggle={() => toggle("telegram")}
          locked={!isOwner}
          lockedMessage="Only the business owner can connect the Telegram bot or link handoff alerts."
        >
          <TelegramPanel
            business={business}
            isOwner={isOwner}
            onChange={applyPatch}
          />
        </ChannelCard>

        {/* DISCORD */}
        <ChannelCard
          id="discord"
          title={getChannelDefinition("discord").label}
          icon={MessageSquare}
          description={getChannelDefinition("discord").description}
          statusLabel={botChannelStatusLabel(discordConnected)}
          statusTone={discordConnected ? "positive" : "neutral"}
          statusDetail={
            discordConnected && business.discordGuildId
              ? `Server ${business.discordGuildId}`
              : null
          }
          creditLabel={channelCreditLabel("discord")}
          actionLabel={actionFor("discord", discordConnected)}
          expanded={openChannel === "discord"}
          onToggle={() => toggle("discord")}
          locked={!isOwner}
          lockedMessage="Only the business owner can connect the Discord bot."
        >
          <DiscordPanel
            business={business}
            isOwner={isOwner}
            onChange={applyPatch}
          />
        </ChannelCard>

        {/* WEB CHAT */}
        <ChannelCard
          id="web-chat"
          title={getChannelDefinition("web_chat").label}
          icon={Globe}
          description={getChannelDefinition("web_chat").description}
          statusLabel={WEB_CHAT_STATUS_LABEL}
          statusTone="positive"
          creditLabel={channelCreditLabel("web_chat")}
          actionLabel={actionFor("web_chat", true)}
          expanded={openChannel === "web_chat"}
          onToggle={() => toggle("web_chat")}
        >
          <WebChatPanel businessId={business.id} />
        </ChannelCard>
      </div>

      <section className="surface-panel mt-6 p-4">
        <h2 className="text-xs font-semibold tracking-wide text-main">
          HOW CREDITS WORK
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          A WhatsApp AI reply costs {channelCreditCost("whatsapp")} credits.
          Telegram, Discord and Web Chat cost {channelCreditCost("telegram")}{" "}
          credits each. Replies you type yourself are always free.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Need more headroom? Top up or change plan under Settings, then Billing.
        </p>
      </section>
    </div>
  );
}
