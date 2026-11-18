"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  Unplug,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { REPLY_CREDIT_COSTS } from "@/lib/plans";

type SessionStatus = "CONNECTED" | "DISCONNECTED" | "QR_READY" | "CONNECTING";

type SessionView = {
  status: SessionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
};

/** How often the page re-reads the session while pairing. */
const POLL_MS = 3_000;

const SECTION_CLASS = "surface-card p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-main";

const STATUS_LABELS: Record<SessionStatus, string> = {
  CONNECTED: "Connected",
  CONNECTING: "Starting",
  QR_READY: "Waiting for scan",
  DISCONNECTED: "Not connected",
};

function isSessionStatus(value: unknown): value is SessionStatus {
  return (
    value === "CONNECTED" ||
    value === "DISCONNECTED" ||
    value === "QR_READY" ||
    value === "CONNECTING"
  );
}

/** The API's error message, or a readable fallback. */
async function responseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  return `Request failed with status ${response.status}`;
}

/** One status read, with the payload narrowed instead of trusted. */
async function readSession(): Promise<SessionView> {
  const response = await fetch("/api/whatsapp/session", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(await responseError(response));
  }

  const data = (await response.json()) as Partial<SessionView>;

  return {
    status: isSessionStatus(data.status) ? data.status : "DISCONNECTED",
    qrCode: typeof data.qrCode === "string" ? data.qrCode : null,
    phoneNumber: typeof data.phoneNumber === "string" ? data.phoneNumber : null,
  };
}

function formatPhone(value: string | null): string {
  if (!value) return "your phone";
  return value.startsWith("+") ? value : `+${value}`;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const palette =
    status === "CONNECTED"
      ? "border-green-200 bg-green-100 text-green-700"
      : status === "QR_READY"
        ? "border-amber-200 bg-amber-100 text-amber-800"
        : status === "CONNECTING"
          ? "border-blue-200 bg-blue-100 text-blue-700"
          : "border-card-border bg-surface-muted text-muted";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${palette}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Settings → WhatsApp.
 *
 * The page never talks to a socket: `POST` asks the standalone worker to start
 * pairing, `GET` is the polling read, and `DELETE` asks for a logout. A
 * 3-second poll is what turns the worker's QR into something scannable here
 * without a refresh, and it also notices a drop/reconnect on a live line.
 */
export default function WhatsAppSettingsPage() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const mounted = useRef(true);
  /** Guards against a slow poll overlapping the next interval tick. */
  const inFlight = useRef(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const next = await readSession();
      if (!mounted.current) return;

      setSession(next);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      // A background poll failing (a blip, a deploy) must not replace a page
      // that already shows useful state with an error box.
      if (!quiet) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load your WhatsApp status.",
        );
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    // The first read runs on the next tick rather than synchronously in the
    // effect body: state updates belong in a callback, and this also lets the
    // page paint its loading state first (react-hooks/set-state-in-effect).
    const initial = setTimeout(() => {
      void load();
    }, 0);

    const timer = setInterval(() => {
      void load({ quiet: true });
    }, POLL_MS);

    return () => {
      mounted.current = false;
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);

  async function connect() {
    if (busy) return;

    setBusy("connect");
    setError(null);

    try {
      const response = await fetch("/api/whatsapp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The tenant comes from the signed-in session; no id is sent.
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error(await responseError(response));

      setSession((prev) => ({
        status: "CONNECTING",
        qrCode: null,
        phoneNumber: prev?.phoneNumber ?? null,
      }));
      setConfirmingDisconnect(false);
      toast.success("Starting your WhatsApp line…");
      await load({ quiet: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start pairing.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (busy) return;

    setBusy("disconnect");
    setError(null);

    try {
      const response = await fetch("/api/whatsapp/session", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error(await responseError(response));

      setSession({ status: "DISCONNECTED", qrCode: null, phoneNumber: null });
      setConfirmingDisconnect(false);
      toast.success("WhatsApp disconnected.");
      await load({ quiet: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not disconnect WhatsApp.",
      );
    } finally {
      setBusy(null);
    }
  }

  const status = session?.status ?? null;
  // A code can be present for a moment while the worker still reports
  // CONNECTING, so show it as soon as it exists.
  const qrValue =
    session && (status === "QR_READY" || status === "CONNECTING")
      ? session.qrCode
      : null;


  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-all duration-250 hover:text-colly"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to settings
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-main">WhatsApp</h1>
          {status && <StatusBadge status={status} />}
        </div>
        <p className="mt-1 text-sm text-muted">
          Pair the number your customers chat with. Colly answers on that line
          from your catalogue and tone, and hands the conversation to you when
          it should.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {!session && !error && (
        <section className={`${SECTION_CLASS} flex items-center gap-3`}>
          <Loader2 className="h-5 w-5 animate-spin text-colly" aria-hidden />
          <p className="text-sm text-muted">
            Loading your WhatsApp status…
          </p>
        </section>
      )}

      {session?.status === "DISCONNECTED" && (
        <section className={SECTION_CLASS}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-colly/10 text-colly">
              <Smartphone className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className={HEADING_CLASS}>CONNECT YOUR WHATSAPP</h2>
              <p className="mt-1 text-sm text-muted">
                Your AI can answer on WhatsApp using this business&apos;s
                products, FAQs and tone. Pairing takes about a minute.
              </p>
              <ol className="mt-4 space-y-1.5 text-sm text-muted">
                <li>1. Press Connect and a QR code appears here.</li>
                <li>
                  2. On the phone that owns the number, open WhatsApp →
                  Settings → Linked devices → Link a device.
                </li>
                <li>3. Scan the code. Customers can then chat with your AI.</li>
              </ol>
              <div className="mt-5">
                <Button
                  type="button"
                  onClick={() => void connect()}
                  loading={busy === "connect"}
                >
                  <Smartphone className="mr-2 h-4 w-4" aria-hidden />
                  Connect WhatsApp
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted">
                Use a number that is not already linked to another WhatsApp Web
                session. You can disconnect at any time.
              </p>
            </div>
          </div>
        </section>
      )}

      {session?.status === "CONNECTING" && !qrValue && (
        <section
          className={`${SECTION_CLASS} flex items-start gap-3`}
          aria-live="polite"
        >
          <Loader2
            className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-colly"
            aria-hidden
          />
          <div>
            <h2 className={HEADING_CLASS}>STARTING YOUR WHATSAPP LINE</h2>
            <p className="mt-1 text-sm text-muted">
              We are opening a secure session for your number. The QR code will
              appear here on its own in a few seconds.
            </p>
            <p className="mt-2 text-xs text-muted">
              If this does not change after a minute, the pairing service may be
              offline. Try Connect again shortly.
            </p>
          </div>
        </section>
      )}

      {qrValue && (
        <section className={SECTION_CLASS} aria-live="polite">
          <h2 className={HEADING_CLASS}>SCAN THIS CODE</h2>
          <p className="mt-1 text-sm text-muted">
            Open WhatsApp on the phone that owns the number, go to Settings →
            Linked devices → Link a device, then point the camera at this code.
          </p>

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              role="img"
              aria-label="WhatsApp pairing QR code"
              className="surface-panel w-fit p-4"
            >
              <QRCodeCanvas value={qrValue} size={224} level="M" />
            </div>
            <div className="max-w-sm space-y-3">
              <p className="text-sm text-muted">
                The code refreshes by itself every few seconds. If your phone
                reports an error, wait for the next one and scan again.
              </p>
              <p className="text-xs text-muted">
                This page checks for a scan every 3 seconds, so it changes to
                Connected without a reload.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void load()}
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Refresh
              </Button>
            </div>
          </div>
        </section>
      )}



      {session?.status === "CONNECTED" && (
        <section className={SECTION_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Connected as {formatPhone(session.phoneNumber)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <QrCode className="h-4 w-4" aria-hidden />
              Linked device
            </span>
          </div>
          <p className="mt-4 text-sm text-muted">
            Messages sent to this number are answered by your AI. Manual replies
            you send from the dashboard still reach the customer through the
            same line.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!confirmingDisconnect ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => setConfirmingDisconnect(true)}
                disabled={busy !== null}
              >
                <Unplug className="mr-2 h-4 w-4" aria-hidden />
                Disconnect
              </Button>
            ) : (
              <>
                <p className="w-full text-sm text-main">
                  Disconnect this number? Your AI stops answering on WhatsApp
                  until you pair again.
                </p>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void disconnect()}
                  loading={busy === "disconnect"}
                >
                  Yes, disconnect
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingDisconnect(false)}
                  disabled={busy === "disconnect"}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </section>
      )}

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>GOOD TO KNOW</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>
            A WhatsApp AI reply costs {REPLY_CREDIT_COSTS.whatsapp} credits,
            against {REPLY_CREDIT_COSTS.standard} on Telegram, Discord and web
            chat, so keep an eye on your balance.
          </li>
          <li>Only the business owner can pair or disconnect the line.</li>
          <li>
            If the phone stays offline for too long WhatsApp unlinks the device.
            Pair it again from this page.
          </li>
        </ul>
      </section>
    </div>
  );
}
