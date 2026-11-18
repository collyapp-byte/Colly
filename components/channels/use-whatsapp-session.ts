"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DISCONNECTED_WHATSAPP_SESSION,
  normalizeWhatsAppSession,
  type WhatsAppSessionView,
} from "@/lib/channels";
import {
  PAIRING_TIMEOUT_MS,
  pairingElapsedSeconds,
} from "@/lib/whatsapp-pairing";

/**
 * The WhatsApp pairing state machine, shared by `/channels` and the older
 * `/settings/whatsapp` page.
 *
 * It never talks to a socket: `POST` asks the standalone worker to start
 * pairing, `GET` is the polling read and `DELETE` asks for a logout. A 3-second
 * poll is what turns the worker's QR into something scannable without a
 * refresh, and it also notices a drop on a live line.
 *
 * The 45-second rule stays server-side (lib/whatsapp-pairing.ts): this hook only
 * reads `session.stalled` and the elapsed seconds, never the browser clock.
 */

/** How often the hub re-reads the session while it is mounted. */
export const WHATSAPP_POLL_MS = 3_000;

/** The timeout in whole seconds, for copy such as "no QR after 45 seconds". */
export const PAIRING_TIMEOUT_SECONDS = Math.round(PAIRING_TIMEOUT_MS / 1000);

export type WhatsAppBusy = "connect" | "disconnect" | "cancel" | null;

export type WhatsAppSessionState = {
  session: WhatsAppSessionView | null;
  error: string | null;
  busy: WhatsAppBusy;
  confirmingDisconnect: boolean;
  setConfirmingDisconnect: (value: boolean) => void;
  /** True when a Connect press has produced nothing for `PAIRING_TIMEOUT_MS`. */
  stalled: boolean;
  /** Whole seconds since the worker last wrote the row. */
  pairingSeconds: number;
  /** A code to render, as soon as the worker produced one. */
  qrValue: string | null;
  load: (options?: { quiet?: boolean }) => Promise<void>;
  connect: () => Promise<void>;
  cancelPairing: () => Promise<void>;
  disconnect: () => Promise<void>;
};

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

/** One status read. */
async function readSession(): Promise<WhatsAppSessionView> {
  const response = await fetch("/api/whatsapp/session", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(await responseError(response));
  }

  return normalizeWhatsAppSession(await response.json());
}

export type UseWhatsAppSessionOptions = {
  /**
   * Only the owner may read or change the session (`requireOwnerApi`). A staff
   * account renders the server-provided status and never polls, so the hub
   * cannot spam a 403 every three seconds.
   */
  enabled?: boolean;
};

export function useWhatsAppSession(
  initialSession: WhatsAppSessionView | null = null,
  { enabled = true }: UseWhatsAppSessionOptions = {},
): WhatsAppSessionState {
  const [session, setSession] = useState<WhatsAppSessionView | null>(
    initialSession,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<WhatsAppBusy>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const mounted = useRef(true);
  /** Guards against a slow poll overlapping the next interval tick. */
  const inFlight = useRef(false);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!enabled) return;
      if (inFlight.current) return;
      inFlight.current = true;

      try {
        const next = await readSession();
        if (!mounted.current) return;

        setSession(next);
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        // A background poll failing (a blip, a deploy) must not replace a card
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
    },
    [enabled],
  );

  useEffect(() => {
    mounted.current = true;

    if (!enabled) {
      return () => {
        mounted.current = false;
      };
    }

    // The first read runs on the next tick rather than synchronously in the
    // effect body: state updates belong in a callback, and this also lets the
    // card paint its server-provided status first.
    const initial = setTimeout(() => {
      void load();
    }, 0);

    const timer = setInterval(() => {
      void load({ quiet: true });
    }, WHATSAPP_POLL_MS);

    return () => {
      mounted.current = false;
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [enabled, load]);

  const connect = useCallback(async () => {
    if (!enabled || busy) return;

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

      // The route answers with the row it just wrote, so the pairing clock
      // restarts from the server's `updatedAt` instead of a stale local one.
      const payload = (await response.json().catch(() => null)) as {
        session?: unknown;
      } | null;

      setSession((prev) =>
        payload?.session
          ? normalizeWhatsAppSession(payload.session)
          : {
              ...DISCONNECTED_WHATSAPP_SESSION,
              status: "CONNECTING",
              phoneNumber: prev?.phoneNumber ?? null,
            },
      );
      setConfirmingDisconnect(false);
      toast.success("Starting your WhatsApp line...");
      await load({ quiet: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start pairing.",
      );
    } finally {
      setBusy(null);
    }
  }, [busy, enabled, load]);

  const disconnect = useCallback(async () => {
    if (!enabled || busy) return;

    setBusy("disconnect");
    setError(null);

    try {
      const response = await fetch("/api/whatsapp/session", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error(await responseError(response));

      setSession(DISCONNECTED_WHATSAPP_SESSION);
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
  }, [busy, enabled, load]);

  /**
   * Abandon a pairing attempt that is going nowhere.
   *
   * Same `DELETE` as Disconnect, on purpose: the worker owns the socket, so the
   * only way to stop it is the logout request the API raises. That also wipes
   * the half-started identity, which is what "never mind, let me try again"
   * means — the next Connect starts from a fresh QR instead of resuming a dead
   * one.
   */
  const cancelPairing = useCallback(async () => {
    if (!enabled || busy) return;

    setBusy("cancel");
    setError(null);

    try {
      const response = await fetch("/api/whatsapp/session", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error(await responseError(response));

      setSession(DISCONNECTED_WHATSAPP_SESSION);
      setConfirmingDisconnect(false);
      toast.success(
        "Pairing cancelled. Press Connect whenever you want to try again.",
      );
      await load({ quiet: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not cancel pairing.",
      );
    } finally {
      setBusy(null);
    }
  }, [busy, enabled, load]);

  const status = session?.status ?? null;
  const stalled = session?.stalled === true;
  const pairingSeconds = session ? pairingElapsedSeconds(session) : 0;
  // A code can be present for a moment while the worker still reports
  // CONNECTING, so show it as soon as it exists.
  const qrValue =
    session && (status === "QR_READY" || status === "CONNECTING")
      ? session.qrCode
      : null;

  return {
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
  };
}
