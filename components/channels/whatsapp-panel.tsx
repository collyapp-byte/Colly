"use client";

import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  Unplug,
  X,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { Button } from "@/components/ui/button";
import {
  PAIRING_TIMEOUT_SECONDS,
  type WhatsAppSessionState,
} from "./use-whatsapp-session";

/**
 * The WhatsApp half of a channel card: pairing, the QR code, the 45-second
 * escape hatch and disconnecting.
 *
 * All the state lives in `useWhatsAppSession`, so `/channels` and the older
 * `/settings/whatsapp` page render identical behaviour from the same hook.
 */

function formatPhone(value: string | null): string {
  if (!value) return "your phone";
  return value.startsWith("+") ? value : `+${value}`;
}

export function WhatsAppPanel({
  state,
  isOwner,
}: {
  state: WhatsAppSessionState;
  isOwner: boolean;
}) {
  const {
    session,
    error,
    busy,
    confirmingDisconnect,
    setConfirmingDisconnect,
    stalled,
    pairingSeconds,
    qrValue,
    load,
    connect,
    cancelPairing,
    disconnect,
  } = state;

  if (!isOwner) {
    return (
      <div className="text-sm text-muted">
        <p className="inline-flex items-center gap-2 font-medium text-main">
          <Smartphone className="h-4 w-4 text-colly" aria-hidden />
          WhatsApp is managed by the business owner.
        </p>
        <p className="mt-2 text-xs leading-relaxed">
          Ask the owner to pair or disconnect this line. You can still reply to
          every WhatsApp conversation from the inbox.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
      >
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">{error}</p>
        {/* A failed read must never leave the owner with nothing to press. */}
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Try again
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <p className="flex items-center gap-3 text-sm text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-colly" aria-hidden />
        Loading your WhatsApp status...
      </p>
    );
  }

  if (session.status === "DISCONNECTED") {
    return (
      <div>
        <p className="text-sm text-muted">
          Your AI can answer on WhatsApp using this business&apos;s products,
          FAQs and tone. Pairing takes about a minute.
        </p>
        <ol className="mt-3 space-y-1.5 text-sm text-muted">
          <li>1. Press Connect and a QR code appears here.</li>
          <li>
            2. On the phone that owns the number, open WhatsApp, then Settings,
            then Linked devices, then Link a device.
          </li>
          <li>3. Scan the code. Customers can then chat with your AI.</li>
        </ol>
        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            onClick={() => void connect()}
            loading={busy === "connect"}
          >
            <Smartphone className="mr-2 h-4 w-4" aria-hidden />
            Connect WhatsApp
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Use a number that is not already linked to another WhatsApp Web
          session. You can disconnect at any time.
        </p>
      </div>
    );
  }

  if (session.status === "CONNECTING" && !qrValue) {
    return (
      <div aria-live="polite" data-pairing-state={stalled ? "stalled" : "starting"}>
        <div className="flex items-start gap-3">
          {stalled ? (
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          ) : (
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-colly" aria-hidden />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-main">
              {stalled
                ? "PAIRING SERVICE NOT RESPONDING"
                : "STARTING YOUR WHATSAPP LINE"}
            </h3>

            {stalled ? (
              <>
                <p className="mt-1 text-sm text-main">
                  No QR code arrived after {pairingSeconds} seconds, so the
                  pairing service is offline or still restarting. Nothing has
                  been linked to your number.
                </p>
                <p className="mt-2 text-xs text-muted">
                  Press Retry / Reconnect to ask again, or Cancel to close this
                  attempt and come back later. You can keep using every other
                  channel in the meantime.
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  We are opening a secure session for your number. The QR code
                  will appear here on its own in a few seconds.
                </p>
                <p className="mt-2 text-xs text-muted">
                  Waiting {pairingSeconds}s. If nothing appears within{" "}
                  {PAIRING_TIMEOUT_SECONDS} seconds you can retry or cancel -
                  this screen never waits forever.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void connect()}
            loading={busy === "connect"}
            disabled={busy !== null && busy !== "connect"}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Retry / Reconnect
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void cancelPairing()}
            loading={busy === "cancel"}
            disabled={busy !== null && busy !== "cancel"}
          >
            <X className="mr-2 h-4 w-4" aria-hidden />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (qrValue) {
    return (
      <div aria-live="polite">
        <h3 className="text-sm font-semibold text-main">SCAN THIS CODE</h3>
        <p className="mt-1 text-sm text-muted">
          Open WhatsApp on the phone that owns the number, go to Settings, then
          Linked devices, then Link a device, and point the camera at this code.
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            role="img"
            aria-label="WhatsApp pairing QR code"
            className="surface-panel w-fit p-3"
          >
            <QRCodeCanvas value={qrValue} size={192} level="M" />
          </div>
          <div className="max-w-sm space-y-2">
            <p className="text-xs text-muted">
              The code refreshes by itself every few seconds. If your phone
              reports an error, wait for the next one and scan again.
            </p>
            <p className="text-xs text-muted">
              This screen checks for a scan every 3 seconds, so it changes to
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
      </div>
    );
  }

  if (session.status === "CONNECTED") {
    return (
      <div>
        <p className="inline-flex flex-wrap items-center gap-2 rounded-full border border-colly/25 bg-colly-tint px-3 py-1 text-sm font-medium text-colly">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Connected as {formatPhone(session.phoneNumber)}
        </p>
        <p className="mt-3 text-sm text-muted">
          Messages sent to this number are answered by your AI. Manual replies
          you send from the dashboard still reach the customer through the same
          line.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!confirmingDisconnect ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
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
                size="sm"
                onClick={() => void disconnect()}
                loading={busy === "disconnect"}
              >
                Yes, disconnect
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmingDisconnect(false)}
                disabled={busy === "disconnect"}
              >
                Cancel
              </Button>
            </>
          )}
        </div>

        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
          <QrCode className="h-4 w-4" aria-hidden />
          Linked device
        </p>
      </div>
    );
  }

  // QR_READY with no code yet. The worker writes the status and the code
  // together, so this is a transient read: say we are waiting instead of
  // painting a "Connected" screen the session does not support.
  return (
    <div aria-live="polite">
      <h3 className="text-sm font-semibold text-main">WAITING FOR THE CODE</h3>
      <p className="mt-1 text-sm text-muted">
        WhatsApp is preparing a QR code. It appears here on its own in a few
        seconds.
      </p>
      <div className="mt-4">
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
  );
}
