"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  Clock,
  Copy,
  MessageSquare,
  PhoneCall,
  Send,
  Share2,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveDiscordBotToken } from "@/app/api/discord/actions";
import { saveWhatsAppSettings } from "@/app/api/whatsapp/actions";
import { toast } from "sonner";
import type { Business } from "@/lib/business";

const SECTION_CLASS = "rounded-lg border border-gray-200 bg-surface p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-gray-900";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

/** How the Telegram AI line works today. */
const HOW_IT_WORKS = [
  "Connect your Telegram bot and the AI answers customers on every message it receives.",
  "Create a bot with @BotFather and share its link. No SIM card, no waiting.",
  "Share your bot link on Instagram, your status, and business cards so customers can reach your AI.",
];

/** Paste this into the Meta Developer Dashboard's webhook field. */
const WHATSAPP_WEBHOOK_URL = "https://colly.com.ng/api/whatsapp/webhook";

/** Self-serve Telegram connection, straight from @BotFather. */
const TELEGRAM_STEPS = [
  "1. Open Telegram and search @BotFather.",
  "2. Send /newbot and follow the steps.",
  "3. Paste the API Token below.",
];

type ConnectResponse = {
  ok?: boolean;
  error?: string;
  botUsername?: string | null;
};

/** Fetches the signed-in owner's business profile (throws on failure). */
async function fetchBusinessData(): Promise<Business> {
  const res = await fetch("/api/business");
  if (res.status === 401) {
    throw new Error("You need to sign in to view your AI line.");
  }
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  const data: { business?: Business } = await res.json();
  if (!data.business) {
    throw new Error("Business not found");
  }
  return data.business;
}

export default function AiLinePage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Connection forms.
  const [botToken, setBotToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Connected-bot share UI.
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Owner notifications (personal Telegram alerts).
  const [ownerChecking, setOwnerChecking] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerLinked, setOwnerLinked] = useState(false);

  // Discord connection.
  const [discordToken, setDiscordToken] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordSaving, setDiscordSaving] = useState(false);
  const [discordError, setDiscordError] = useState<string | null>(null);
  const [discordNotice, setDiscordNotice] = useState<string | null>(null);

  // WhatsApp Cloud API connection.
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState("");
  const [whatsappAccessToken, setWhatsappAccessToken] = useState("");
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState("");
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [whatsappNotice, setWhatsappNotice] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const loadBusiness = useCallback(async () => {
    try {
      const data = await fetchBusinessData();
      setBusiness(data);
      setOwnerLinked(Boolean(data.ownerTelegramChatId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchBusinessData()
      .then((data) => {
        if (!active) return;
        setBusiness(data);
        setOwnerLinked(Boolean(data.ownerTelegramChatId));
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      });
    return () => {
      active = false;
    };
  }, []);

  const loading = business === null && error === null;

  // Per-channel connection state.
  const telegramIsConnected = Boolean(business?.telegramBotToken);
  const discordIsConnected = Boolean(business?.discordBotToken);
  const whatsappIsConnected = Boolean(business?.whatsappAccessToken);

  // The owner's shareable bot link once the bot is connected.
  const shareLink = business?.telegramBotUsername
    ? `https://t.me/${business.telegramBotUsername}`
    : null;

  // Render the share link as an SVG QR code with the `qrcode` package (the
  // same one the agent certificate uses). Generated in the browser after
  // connect; a stale or failed render just leaves the plain link visible.
  useEffect(() => {
    if (!shareLink || !telegramIsConnected) return;

    let active = true;
    import("qrcode")
      .then((mod) =>
        mod.toString(shareLink, { type: "svg", margin: 1, width: 168 }),
      )
      .then((svg) => {
        if (active) setQrSvg(svg);
      })
      .catch(() => {
        // No QR available; the plain link below is still shown.
      });

    return () => {
      active = false;
    };
  }, [shareLink, telegramIsConnected]);

  async function handleCopyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context): leave the link on screen to
      // copy manually.
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

  async function postJson(
    url: string,
    payload: unknown,
    method: "POST" | "DELETE" = "POST",
  ): Promise<{ failure: string | null; data: ConnectResponse | null }> {
    // Returns an error message (or null on success) plus the parsed body. Only
    // the network failure is caught here: a response that did arrive is read
    // and reported as-is, so the API's own message (e.g. an invalid bot token)
    // is never replaced by "could not reach the server".
    let res: Response;
    try {
      res = await fetch(url, {
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

    const data = (await res.json().catch(() => null)) as ConnectResponse | null;
    if (!res.ok || !data?.ok) {
      return {
        failure: data?.error ?? "Something went wrong. Please try again.",
        data,
      };
    }
    return { failure: null, data };
  }

  async function handleTelegramConnect(event: FormEvent<HTMLFormElement>) {
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
      "Bot connected. New messages to your bot are now answered by your AI assistant.",
    );
    toast.success("Telegram bot connected! Your AI assistant is now live.");
    // Optimistically flip the card to the connected state, then refetch so the
    // stored token/username (not just the status) drive the UI.
    setBusiness((prev) =>
      prev
        ? {
            ...prev,
            connectionStatus: "CONNECTED",
            telegramBotToken: botToken,
            telegramBotUsername: data?.botUsername ?? prev.telegramBotUsername,
          }
        : prev,
    );
    await loadBusiness();
  }

  async function handleTelegramDisconnect() {
    if (
      !window.confirm(
        "Disconnect your Telegram bot? Customers will no longer get AI replies until you reconnect.",
      )
    ) {
      return;
    }
    setDisconnecting(true);
    const { failure } = await postJson(
      "/api/telegram/connect",
      {},
      "DELETE",
    );
    setDisconnecting(false);
    if (failure) {
      setFormError(failure);
      toast.error(failure);
      return;
    }
    setNotice(null);
    setQrSvg(null);
    toast.success("Telegram bot disconnected.");
    setBusiness((prev) =>
      prev
        ? {
            ...prev,
            connectionStatus: "DISCONNECTED",
            telegramBotToken: null,
            telegramBotUsername: null,
          }
        : prev,
    );
    await loadBusiness();
  }

  async function handleDiscordConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDiscordError(null);
    setDiscordNotice(null);
    setDiscordSaving(true);

    const botToken = discordToken.trim();

    try {
      const result = await saveDiscordBotToken({
        botToken,
        guildId: discordGuildId,
      });

      if (!result.ok) {
        setDiscordError(result.error);
        toast.error(result.error);
        return;
      }

      setDiscordToken("");
      setDiscordNotice(
        "Discord bot connected. Messages in your server are now answered by your AI assistant.",
      );
      toast.success("Discord bot connected!");
      setBusiness((prev) =>
        prev
          ? {
              ...prev,
              discordBotToken: botToken,
              discordGuildId: result.discordGuildId,
            }
          : prev,
      );
      await loadBusiness();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setDiscordError(message);
      toast.error(message);
    } finally {
      setDiscordSaving(false);
    }
  }

  async function handleWhatsAppConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWhatsappError(null);
    setWhatsappNotice(null);
    setWhatsappSaving(true);

    const phoneNumberId = whatsappPhoneNumberId.trim();
    const accessToken = whatsappAccessToken.trim();
    const verifyToken = whatsappVerifyToken.trim();

    try {
      const result = await saveWhatsAppSettings({
        phoneNumberId,
        accessToken,
        verifyToken,
      });

      if (!result.ok) {
        setWhatsappError(result.error);
        toast.error(result.error);
        return;
      }

      setWhatsappAccessToken("");
      setWhatsappVerifyToken("");
      setWhatsappNotice(
        "WhatsApp connected. New messages to your number are now answered by your AI assistant.",
      );
      toast.success("WhatsApp connected!");
      setBusiness((prev) =>
        prev
          ? {
              ...prev,
              whatsappPhoneNumberId: result.whatsappPhoneNumberId,
              whatsappAccessToken: accessToken,
              whatsappVerifyToken: verifyToken,
            }
          : prev,
      );
      await loadBusiness();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setWhatsappError(message);
      toast.error(message);
    } finally {
      setWhatsappSaving(false);
    }
  }

  async function handleCopyWebhook() {
    try {
      await navigator.clipboard.writeText(WHATSAPP_WEBHOOK_URL);
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context): the URL stays on screen.
    }
  }

  async function handleVerifyOwnerAlerts() {
    setOwnerError(null);
    setOwnerChecking(true);

    try {
      const data = await fetchBusinessData();
      setBusiness(data);
      setOwnerLinked(Boolean(data.ownerTelegramChatId));
      if (!data.ownerTelegramChatId) {
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/settings"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-colly"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to settings
      </Link>

      <h1 className="font-display text-2xl text-gray-900">AI Line</h1>
      <p className="mt-1 text-sm text-gray-500">
        Connect Telegram, Discord, or WhatsApp and the AI answers customers on
        every message.
      </p>

      {/* HOW IT WORKS — compact orientation box right under the header. */}
      <section className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
        <h2 className="font-display text-base text-gray-900">How it works</h2>
        <ul className="mt-3 space-y-2">
          {HOW_IT_WORKS.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 text-gray-600"
            >
              <PhoneCall
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6600]"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      {loading && <AiLineSkeleton />}

      {!business && error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {business && (
        <div className="mt-6 space-y-6">
          {/* CHANNEL STATUS */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>Channel Status</h2>
            <div className="mt-4 space-y-3">
              <a
                href="#connect-whatsapp"
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Smartphone className="h-4 w-4 text-gray-500" aria-hidden />
                  WhatsApp
                </span>
                {whatsappIsConnected ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[12px] font-medium text-green-700">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[12px] font-medium text-red-600">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Disconnected
                  </span>
                )}
              </a>

              <a
                href="#connect-telegram"
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Send className="h-4 w-4 text-gray-500" aria-hidden />
                  Telegram
                </span>
                {telegramIsConnected ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[12px] font-medium text-green-700">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[12px] font-medium text-red-600">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Disconnected
                  </span>
                )}
              </a>

              <a
                href="#connect-discord"
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                  <MessageSquare className="h-4 w-4 text-gray-500" aria-hidden />
                  Discord
                </span>
                {discordIsConnected ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[12px] font-medium text-green-700">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[12px] font-medium text-red-600">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Disconnected
                  </span>
                )}
              </a>
            </div>
          </section>

          {/* TELEGRAM CONNECTION — the primary section, always first. */}
          <section id="connect-telegram" className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>Connect your Telegram Bot</h2>

            {telegramIsConnected ? (
              <div
                role="status"
                className="mt-4 rounded-lg border border-green-200 bg-green-50 p-5"
              >
                <div className="flex items-center gap-2">
                  <BadgeCheck
                    className="h-5 w-5 shrink-0 text-green-600"
                    aria-hidden
                  />
                  <h3 className="font-display text-base font-semibold text-green-800">
                    ✅ Telegram Bot Connected
                  </h3>
                </div>

                {business.telegramBotUsername && (
                  <p className="mt-2 text-sm font-medium text-green-800">
                    @{business.telegramBotUsername}
                  </p>
                )}

                {shareLink ? (
                  <>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareLink}
                        aria-label="Your bot link"
                        onFocus={(event) => event.target.select()}
                        className={`${INPUT_CLASS} bg-white`}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyLink}
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {copied ? "Copied!" : "Copy Link"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleShareLink}
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden />
                        Share
                      </Button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-start gap-4">
                      {qrSvg && (
                        <div
                          className="shrink-0 rounded-lg border border-green-200 bg-white p-2 [&>svg]:block"
                          aria-hidden
                          dangerouslySetInnerHTML={{ __html: qrSvg }}
                        />
                      )}

                      <div className="min-w-0">
                        <p className="text-sm text-green-800">
                          Share this link on Instagram, WhatsApp Status, and
                          business cards. Print the QR code and paste it in
                          your shop so customers can scan and chat.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-green-800">
                    Your bot is connected. Message it and the AI will reply from
                    your dashboard.
                  </p>
                )}

                {formError && (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {formError}
                  </p>
                )}

                <div className="mt-5 border-t border-green-100 pt-3">
                  <button
                    type="button"
                    onClick={handleTelegramDisconnect}
                    disabled={disconnecting}
                    className="text-xs font-medium text-danger underline-offset-2 transition-colors hover:underline disabled:opacity-50"
                  >
                    {disconnecting
                      ? "Disconnecting…"
                      : "Disconnect Bot"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <ol className="mt-4 space-y-2">
                  {TELEGRAM_STEPS.map((step) => (
                    <li
                      key={step}
                      className="flex items-start gap-3 text-sm text-gray-600"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF4EC] text-[#FF6600]">
                        <Send className="h-3 w-3" aria-hidden />
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <form onSubmit={handleTelegramConnect} className="mt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="botToken"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Bot Token
                    </label>
                    <input
                      id="botToken"
                      name="botToken"
                      type="text"
                      value={botToken}
                      onChange={(event) => setBotToken(event.target.value)}
                      placeholder="123456789:AA..."
                      autoComplete="off"
                      required
                      className={INPUT_CLASS}
                    />
                  </div>

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

                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={submitting}
                  >
                    Connect Bot
                  </Button>
                </form>
              </>
            )}
          </section>

          {/* DISCORD CONNECTION — sits directly below Telegram. */}
          <section id="connect-discord" className={SECTION_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={HEADING_CLASS}>Connect Discord</h2>
              {discordIsConnected ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[12px] font-medium text-green-700">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[12px] font-medium text-red-600">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Disconnected
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Connect a Discord bot and your AI answers messages in your server.
              Create an application at{" "}
              <span className="font-medium text-gray-700">
                discord.com/developers/applications
              </span>
              , add a Bot, then paste its token below.
            </p>

            {discordIsConnected && (
              <div
                role="status"
                className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
              >
                <p className="font-semibold">Discord bot connected</p>
                {business.discordGuildId && (
                  <p className="mt-1">
                    Server ID:{" "}
                    <span className="font-mono text-[13px]">
                      {business.discordGuildId}
                    </span>
                  </p>
                )}
                <p className="mt-1 text-green-700">
                  Paste a new token below to replace the current one.
                </p>
              </div>
            )}

            <form onSubmit={handleDiscordConnect} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="discordBotToken"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Discord Bot Token
                </label>
                <input
                  id="discordBotToken"
                  name="discordBotToken"
                  type="text"
                  value={discordToken}
                  onChange={(event) => setDiscordToken(event.target.value)}
                  placeholder={
                    discordIsConnected
                      ? "Connected — paste a new token to replace"
                      : "Paste your Discord bot token"
                  }
                  autoComplete="off"
                  required
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="discordGuildId"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Discord Server ID{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="discordGuildId"
                  name="discordGuildId"
                  type="text"
                  inputMode="numeric"
                  value={discordGuildId}
                  onChange={(event) => setDiscordGuildId(event.target.value)}
                  placeholder="e.g. 123456789012345678"
                  autoComplete="off"
                  className={INPUT_CLASS}
                />
                <p className="mt-1 text-xs text-gray-500">
                  The server the bot should answer in. Enable Developer Mode in
                  Discord, right-click your server, and copy the server id.
                </p>
              </div>

              {discordError && (
                <p role="alert" className="text-sm text-danger">
                  {discordError}
                </p>
              )}
              {discordNotice && (
                <p role="status" className="text-sm text-success">
                  {discordNotice}
                </p>
              )}

              <Button type="submit" variant="primary" isLoading={discordSaving}>
                {discordIsConnected
                  ? "Update Discord Token"
                  : "Connect Discord"}
              </Button>
            </form>
          </section>

          {/* OWNER NOTIFICATIONS (personal Telegram) — second, right after the
              bot connection. Highlighted with a thicker orange border while
              still unset. */}
          <section
            id="owner-alerts"
            className={`${SECTION_CLASS} ${
              !business.ownerTelegramChatId
                ? "border-2 border-[#FF6600]"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[#FF6600]" aria-hidden />
              <h2 className={HEADING_CLASS}>Owner Notifications (Telegram)</h2>
            </div>
            {!ownerLinked && (
              <p className="mt-3 rounded-lg border border-[#FF6600]/30 bg-[#FFF4EC] px-3 py-2 text-sm font-medium text-[#C2410C]">
                ⚠️ Required for AI handoffs. If not set, you will not know when the
                AI needs your help.
              </p>
            )}
            <p className="mt-3 text-sm text-gray-600">
              Get alerts on your personal phone when the AI needs you to step
              in — for example a waybill question or a custom quote. Alerts go
              to your personal Telegram chat, never to your customer chats.
            </p>

            <ol className="mt-3 space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-700">1.</span>
                <span>
                  Open your Telegram bot:{" "}
                  <span className="font-medium text-gray-700">
                    {business.telegramBotUsername
                      ? `@${business.telegramBotUsername}`
                      : "your bot"}
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-700">2.</span>
                <span>
                  Send this command:{" "}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] text-gray-800">
                    /startowner
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-700">3.</span>
                <span>Click Verify below.</span>
              </li>
            </ol>

            <div className="mt-4 space-y-3">
              {ownerLinked && (
                <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-100 px-3 py-1 text-[13px] font-medium text-green-700">
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  ✅ Owner Alerts Active
                </span>
              )}

              {ownerError && (
                <p role="alert" className="text-sm text-danger">
                  {ownerError}
                </p>
              )}

              <Button
                type="button"
                variant="primary"
                isLoading={ownerChecking}
                onClick={handleVerifyOwnerAlerts}
              >
                Verify Connection
              </Button>
            </div>
          </section>

          {/* WHATSAPP CONNECTION — Meta WhatsApp Cloud API. */}
          <section id="connect-whatsapp" className={SECTION_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={HEADING_CLASS}>Connect your WhatsApp</h2>
              {whatsappIsConnected ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[12px] font-medium text-green-700">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[12px] font-medium text-red-600">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Disconnected
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Connect a WhatsApp number through the Meta WhatsApp Cloud API.
              Open your Meta app, copy the phone number id and a permanent
              access token, then paste them below.
            </p>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <label
                htmlFor="whatsappWebhookUrl"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Webhook URL
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="whatsappWebhookUrl"
                  type="text"
                  readOnly
                  value={WHATSAPP_WEBHOOK_URL}
                  onFocus={(event) => event.target.select()}
                  className={`${INPUT_CLASS} min-w-0 flex-1 bg-white font-mono text-[13px]`}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyWebhook}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {webhookCopied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Paste this into the Callback URL field under WhatsApp &rarr;
                Configuration in the Meta Developer Dashboard.
              </p>
            </div>

            {whatsappIsConnected && (
              <div
                role="status"
                className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
              >
                <p className="font-semibold">WhatsApp connected</p>
                {business.whatsappPhoneNumberId && (
                  <p className="mt-1">
                    Phone number ID:{" "}
                    <span className="font-mono text-[13px]">
                      {business.whatsappPhoneNumberId}
                    </span>
                  </p>
                )}
                <p className="mt-1 text-green-700">
                  Paste new credentials below to replace the current ones.
                </p>
              </div>
            )}

            <form onSubmit={handleWhatsAppConnect} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="whatsappPhoneNumberId"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  WhatsApp Phone Number ID
                </label>
                <input
                  id="whatsappPhoneNumberId"
                  name="whatsappPhoneNumberId"
                  type="text"
                  inputMode="numeric"
                  value={whatsappPhoneNumberId}
                  onChange={(event) =>
                    setWhatsappPhoneNumberId(event.target.value)
                  }
                  placeholder="e.g. 123456789012345"
                  autoComplete="off"
                  required
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="whatsappAccessToken"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  WhatsApp Access Token
                </label>
                <input
                  id="whatsappAccessToken"
                  name="whatsappAccessToken"
                  type="password"
                  value={whatsappAccessToken}
                  onChange={(event) =>
                    setWhatsappAccessToken(event.target.value)
                  }
                  placeholder="EAAG..."
                  autoComplete="new-password"
                  required
                  className={INPUT_CLASS}
                />
                <p className="mt-1 text-xs text-gray-500">
                  A permanent access token from your Meta app. Kept private and
                  used only to send replies.
                </p>
              </div>

              <div>
                <label
                  htmlFor="whatsappVerifyToken"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  WhatsApp Verify Token
                </label>
                <input
                  id="whatsappVerifyToken"
                  name="whatsappVerifyToken"
                  type="text"
                  value={whatsappVerifyToken}
                  onChange={(event) =>
                    setWhatsappVerifyToken(event.target.value)
                  }
                  placeholder="A random string, e.g. colly-wa-8f2k9q"
                  autoComplete="off"
                  required
                  minLength={8}
                  className={INPUT_CLASS}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Generate any random string of at least 8 characters, then
                  enter the same value in Meta&apos;s webhook setup.
                </p>
              </div>

              {whatsappError && (
                <p role="alert" className="text-sm text-danger">
                  {whatsappError}
                </p>
              )}
              {whatsappNotice && (
                <p role="status" className="text-sm text-success">
                  {whatsappNotice}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                isLoading={whatsappSaving}
              >
                {whatsappIsConnected
                  ? "Update WhatsApp"
                  : "Connect WhatsApp"}
              </Button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

/** Placeholder shown while the business profile loads. */
function AiLineSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      {[0, 1, 2].map((card) => (
        <div
          key={card}
          className="rounded-lg border border-gray-200 bg-surface p-5 sm:p-6"
        >
          <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
          <div className="mt-4 space-y-3">
            <div className="h-6 w-40 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
