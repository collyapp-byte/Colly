"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  Clock,
  Copy,
  PhoneCall,
  Send,
  Share2,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

/** Self-serve Telegram connection, straight from @BotFather. */
const TELEGRAM_STEPS = [
  "1. Open Telegram and search @BotFather.",
  "2. Send /newbot and follow the steps.",
  "3. Paste the API Token below.",
];

type ConnectResponse = { ok?: boolean; error?: string };

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

  // Owner notifications (personal Telegram alerts).
  const [ownerChatId, setOwnerChatId] = useState("");
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerNotice, setOwnerNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/business");
        if (res.status === 401) {
          throw new Error("You need to sign in to view your AI line.");
        }
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { business?: Business } = await res.json();
        if (active && data.business) {
          setBusiness(data.business);
          setOwnerChatId(data.business.ownerTelegramChatId ?? "");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const loading = business === null && error === null;
  const connectionStatus = business?.connectionStatus ?? "DISCONNECTED";
  const connected = connectionStatus === "CONNECTED";

  // Per-channel connection state. Telegram is the only live channel; WhatsApp
  // is postponed until Meta verification clears.
  const telegramIsConnected = Boolean(business?.telegramBotToken);

  // The owner's shareable bot link once the bot is connected.
  const shareLink = business?.telegramBotUsername
    ? `https://t.me/${business.telegramBotUsername}`
    : null;

  // Render the share link as an SVG QR code with the `qrcode` package (the
  // same one the agent certificate uses). Generated in the browser after
  // connect; a stale or failed render just leaves the plain link visible.
  useEffect(() => {
    if (!shareLink || !connected) return;

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
  }, [shareLink, connected]);

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

  async function postJson(url: string, payload: unknown): Promise<string | null> {
    // Returns an error message, or null on success. Only the network failure is
    // caught here: a response that did arrive is read and reported as-is, so
    // the API's own message (e.g. an invalid bot token) is never replaced by
    // "could not reach the server".
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      return "Could not reach the server. Check your connection and try again.";
    }

    const data = (await res.json().catch(() => null)) as ConnectResponse | null;
    if (!res.ok || !data?.ok) {
      return data?.error ?? "Something went wrong. Please try again.";
    }
    return null;
  }

  async function handleTelegramConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    setSubmitting(true);

    const failure = await postJson("/api/telegram/connect", { botToken });

    setSubmitting(false);
    if (failure) {
      setFormError(failure);
      return;
    }
    setBotToken("");
    setNotice(
      "Bot connected. New messages to your bot are now answered by your AI assistant.",
    );
    setBusiness((prev) =>
      prev ? { ...prev, connectionStatus: "CONNECTED" } : prev,
    );
  }

  async function handleSaveOwnerAlerts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOwnerError(null);
    setOwnerNotice(null);
    setOwnerSaving(true);

    const trimmed = ownerChatId.trim();

    // Only a network failure is caught here, matching postJson: a response
    // that did arrive is read and reported as-is so the API's message (e.g.
    // an invalid chat id) is never replaced by a generic one.
    let res: Response;
    try {
      res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerTelegramChatId: trimmed }),
      });
    } catch {
      setOwnerSaving(false);
      setOwnerError(
        "Could not reach the server. Check your connection and try again.",
      );
      return;
    }

    const data = (await res.json().catch(() => null)) as {
      business?: Business;
      error?: string;
    } | null;
    setOwnerSaving(false);

    if (!res.ok || !data?.business) {
      setOwnerError(data?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setBusiness(data.business);
    setOwnerChatId(data.business.ownerTelegramChatId ?? "");
    setOwnerNotice(
      trimmed
        ? "Saved. You will get an alert on this chat whenever the AI needs you to step in."
        : "Saved. Owner alerts are turned off.",
    );
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
        Connect your Telegram bot and the AI answers customers on every message.
        WhatsApp is coming soon.
      </p>

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
          {/* CURRENT STATUS */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>CURRENT STATUS</h2>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-400">
                  <Smartphone className="h-4 w-4 text-gray-400" aria-hidden />
                  WhatsApp
                </span>
                <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
                  Coming Soon
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
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
                  <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[12px] font-medium text-gray-600">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Disconnected
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* OWNER NOTIFICATIONS (personal Telegram) — first so it is never missed.
              Highlighted with a thicker orange border while still unset. */}
          <section
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
            <p className="mt-3 rounded-lg border border-[#FF6600]/30 bg-[#FFF4EC] px-3 py-2 text-sm font-medium text-[#C2410C]">
              ⚠️ Required for AI handoffs. If not set, you will not know when the
              AI needs your help.
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Get alerts on your personal phone when the AI needs you to step
              in — for example a waybill question or a custom quote. Alerts go
              to your personal Telegram chat, never to your customer chats.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Message <span className="font-medium text-gray-700">@userinfobot</span>{" "}
              on Telegram to get your ID, then paste it below. Leave it empty to
              turn alerts off.
            </p>

            <form onSubmit={handleSaveOwnerAlerts} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="ownerChatId"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Your Personal Telegram Chat ID
                </label>
                <input
                  id="ownerChatId"
                  name="ownerChatId"
                  type="text"
                  inputMode="numeric"
                  value={ownerChatId}
                  onChange={(event) => {
                    setOwnerChatId(event.target.value);
                    setOwnerNotice(null);
                  }}
                  placeholder="123456789"
                  autoComplete="off"
                  className={INPUT_CLASS}
                />
              </div>

              {ownerError && (
                <p role="alert" className="text-sm text-danger">
                  {ownerError}
                </p>
              )}
              {ownerNotice && (
                <p role="status" className="text-sm text-success">
                  {ownerNotice}
                </p>
              )}

              <Button type="submit" variant="primary" loading={ownerSaving}>
                Save
              </Button>
            </form>
          </section>

          {/* TELEGRAM CONNECTION */}
          <section className={SECTION_CLASS}>
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
                    Your Telegram Bot is Live!
                  </h3>
                </div>

                {shareLink ? (
                  <>
                    <a
                      href={shareLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block break-all font-display text-xl font-bold text-gray-900 underline decoration-green-300 underline-offset-4 transition-colors hover:text-green-800"
                    >
                      {shareLink}
                    </a>

                    <div className="mt-4 flex flex-wrap items-start gap-4">
                      {qrSvg && (
                        <div
                          className="shrink-0 rounded-lg border border-green-200 bg-white p-2 [&>svg]:block"
                          aria-hidden
                          dangerouslySetInnerHTML={{ __html: qrSvg }}
                        />
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
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
                        <p className="mt-3 text-sm text-green-800">
                          Share this link on Instagram, WhatsApp Status, and
                          business cards.
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
                    loading={submitting}
                  >
                    Connect Bot
                  </Button>
                </form>
              </>
            )}
          </section>

          {/* WHATSAPP CONNECTION — postponed until Meta verification clears */}
          <section className={`${SECTION_CLASS} opacity-80`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={`${HEADING_CLASS} text-gray-500`}>
                Connect your WhatsApp
              </h2>
              <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
                Coming Soon
              </span>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                WhatsApp integration is pending Meta business verification. We
                will notify you as soon as it is ready!
              </p>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>HOW IT WORKS</h2>
            <ul className="mt-4 space-y-3">
              {HOW_IT_WORKS.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-3 text-sm text-gray-600"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF4EC] text-[#FF6600]">
                    <PhoneCall className="h-3 w-3" aria-hidden />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
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
