"use client";

import { useState, type FormEvent } from "react";
import { BadgeCheck, Copy, Send, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { telegramBotLink } from "@/lib/channels";
import type { ChannelBusinessPatch, ChannelBusinessView } from "./types";

/**
 * Telegram setup inside a Channels card.
 *
 * Same endpoint as Settings → AI & Channels (`POST /api/telegram/connect`),
 * same owner-only rule (the route answers 403 for staff), but compact: paste
 * the BotFather token, then link handoff alerts by sending `/startowner`.
 */

const INPUT_CLASS =
  "w-full rounded-lg border border-card-border bg-card-surface px-3 py-2 text-sm text-main outline-none transition-all duration-250 focus:border-colly focus:ring-2 focus:ring-colly/20";

type ConnectResponse = {
  ok?: boolean;
  error?: string;
  botUsername?: string | null;
};

async function postJson(
  url: string,
  payload: unknown,
  method: "POST" | "DELETE" = "POST",
): Promise<{ failure: string | null; data: ConnectResponse | null }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(payload) : undefined,
    });
  } catch {
    return {
      failure: "Could not reach the server. Check your connection and try again.",
      data: null,
    };
  }

  const data = (await response.json().catch(() => null)) as ConnectResponse | null;
  if (!response.ok || !data?.ok) {
    return {
      failure: data?.error ?? "Something went wrong. Please try again.",
      data,
    };
  }
  return { failure: null, data };
}

export function TelegramPanel({
  business,
  isOwner,
  onChange,
}: {
  business: ChannelBusinessView;
  isOwner: boolean;
  onChange: (patch: ChannelBusinessPatch) => void;
}) {
  const [botToken, setBotToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ownerChecking, setOwnerChecking] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const connected = business.telegramConnected;
  const shareLink = telegramBotLink(business.telegramBotUsername);
  const ownerLinked = Boolean(business.ownerTelegramChatId);

  async function handleCopyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Bot link copied");
    } catch {
      // Clipboard unavailable (insecure context): the link stays on screen.
    }
  }

  async function handleShareLink() {
    if (!shareLink) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "My business is on Colly",
          url: shareLink,
        });
      } catch {
        // The owner dismissed the share sheet.
      }
    } else {
      await handleCopyLink();
    }
  }

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    setSubmitting(true);

    const { failure, data } = await postJson("/api/telegram/connect", {
      botToken,
    });

    setSubmitting(false);
    if (failure) {
      setFormError(failure);
      toast.error(failure);
      return;
    }

    setBotToken("");
    setNotice(
      "Bot connected. New messages to your bot are answered by your AI assistant.",
    );
    toast.success("Telegram bot connected! Your AI assistant is now live.");
    onChange({
      telegramConnected: true,
      telegramBotUsername: data?.botUsername ?? business.telegramBotUsername,
    });
  }

  async function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect your Telegram bot? Customers will no longer get AI replies until you reconnect.",
      )
    ) {
      return;
    }

    setDisconnecting(true);
    const { failure } = await postJson("/api/telegram/connect", {}, "DELETE");
    setDisconnecting(false);

    if (failure) {
      setFormError(failure);
      toast.error(failure);
      return;
    }

    setNotice(null);
    toast.success("Telegram bot disconnected.");
    onChange({ telegramConnected: false, telegramBotUsername: null });
  }

  async function handleVerifyOwnerAlerts() {
    setOwnerError(null);
    setOwnerChecking(true);

    try {
      const response = await fetch("/api/business");
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = (await response.json()) as {
        business?: { ownerTelegramChatId?: string | null } | null;
      };
      const ownerTelegramChatId = data.business?.ownerTelegramChatId ?? null;

      onChange({ ownerTelegramChatId });

      if (!ownerTelegramChatId) {
        setOwnerError(
          "Not linked yet. Make sure you sent /startowner to your bot.",
        );
        toast.error("Not linked yet. Send /startowner to your bot, then retry.");
        return;
      }
      toast.success("Owner alerts verified! You will get alerts in Telegram.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setOwnerError(message);
      toast.error(message);
    } finally {
      setOwnerChecking(false);
    }
  }

  if (!isOwner) {
    return (
      <div className="text-sm text-muted">
        <p className="inline-flex items-center gap-2 font-medium text-main">
          <Send className="h-4 w-4 text-colly" aria-hidden />
          Telegram is managed by the business owner.
        </p>
        <p className="mt-2 text-xs leading-relaxed">
          Ask the owner to connect the bot or link handoff alerts. You can reply
          to every Telegram conversation from the inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {connected ? (
        <div>
          <p className="inline-flex flex-wrap items-center gap-2 rounded-full border border-colly/25 bg-colly-tint px-3 py-1 text-sm font-medium text-colly">
            <BadgeCheck className="h-4 w-4" aria-hidden />
            Bot connected
            {business.telegramBotUsername
              ? ` as @${business.telegramBotUsername.replace(/^@/, "")}`
              : ""}
          </p>

          {shareLink ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                aria-label="Your bot link"
                onFocus={(event) => event.target.select()}
                className={`${INPUT_CLASS} min-w-0 flex-1`}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleCopyLink()}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleShareLink()}
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden />
                Share
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Message your bot and the AI replies from your catalogue and tone.
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={disconnecting}
            className="mt-3 text-xs font-medium text-danger underline-offset-2 transition-all duration-250 hover:underline disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect bot"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3">
          <ol className="space-y-1.5 text-xs text-muted">
            <li>1. Open Telegram and search @BotFather.</li>
            <li>2. Send /newbot and follow the steps.</li>
            <li>3. Paste the API token below.</li>
          </ol>

          <div>
            <label
              htmlFor="channels-telegram-token"
              className="mb-1 block text-xs font-medium text-main"
            >
              BotFather API token
            </label>
            <input
              id="channels-telegram-token"
              type="password"
              value={botToken}
              onChange={(event) => setBotToken(event.target.value)}
              placeholder="123456789:AA..."
              autoComplete="off"
              required
              className={INPUT_CLASS}
            />
          </div>

          <Button type="submit" size="sm" isLoading={submitting}>
            <Send className="mr-2 h-4 w-4" aria-hidden />
            Connect Telegram
          </Button>
        </form>
      )}

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      )}

      {/* STEP 2: handoff alerts go to the owner's own chat, never a customer's. */}
      <div className="rounded-lg border border-card-border bg-card-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold tracking-wide text-main">
            HANDOFF ALERTS
          </h4>
          {ownerLinked && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-colly/25 bg-colly-tint px-2.5 py-0.5 text-[11px] font-medium text-colly">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Active
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Get a Telegram message on your own phone when the AI needs you. Send{" "}
          <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[12px] text-main">
            /startowner
          </span>{" "}
          to your bot, then verify.
        </p>
        {!connected && (
          <p className="mt-2 text-xs text-muted">
            Connect the bot first - the command only works once it is live.
          </p>
        )}
        {ownerError && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {ownerError}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          isLoading={ownerChecking}
          disabled={!connected || ownerChecking}
          onClick={() => void handleVerifyOwnerAlerts()}
        >
          <BadgeCheck className="mr-2 h-4 w-4" aria-hidden />
          Verify connection
        </Button>
      </div>
    </div>
  );
}
