/**
 * Lifecycle for the long-lived WhatsApp worker.
 *
 * `lib/whatsapp-session.ts` knows how to answer one message; this module owns
 * what survives between messages: which tenants have a socket, what the socket
 * last told us, when to reconnect and when a pairing is dead for good.
 *
 * Everything external is injected (`createSession`, `setStatus`, timers), so the
 * whole state machine is unit-tested without a socket, a database or a 5-second
 * wait. The concrete Baileys wiring lives in `whatsapp-worker.ts`.
 *
 * STATE MACHINE (one row per business, `WhatsAppSession.status`):
 *
 *   CONNECTING   a socket was asked for (by the web app, or by the poller)
 *   QR_READY     `connection.update` carried a QR — the owner must scan it
 *   CONNECTED    `connection === "open"`; the phone number is stored
 *   DISCONNECTED `connection === "close"`; reconnecting with backoff, unless the
 *                device was logged out (401), which wipes the stored creds so a
 *                fresh QR can be generated instead of retrying a dead identity
 *
 * No Baileys import here on purpose: the manager is pure TypeScript, so a test
 * never needs to load the native Signal bridge.
 */

import { isBoom } from "@hapi/boom";

import type { WhatsAppSessionState } from "@/lib/whatsapp-session";

/**
 * The subset of Baileys' `connection.update` the worker acts on, already
 * flattened: the entry point unwraps `lastDisconnect.error` into `statusCode`
 * and reads the connected phone number from the socket.
 */
export type WhatsAppSessionSignal = {
  connection?: "open" | "connecting" | "close" | string | null;
  qr?: string | null;
  /** The paired number, digits only (`sock.user.id` without the JID suffix). */
  phoneNumber?: string | null;
  /** `lastDisconnect.error.output.statusCode` (Boom), already unwrapped. */
  statusCode?: number;
};

/** One live socket, as the manager sees it. */
export type WhatsAppSessionHandle = {
  close: () => void | Promise<void>;
  /**
   * Unlink the device properly (Baileys' `sock.logout()`), rather than just
   * dropping the connection. Optional: a transport that cannot log out is
   * closed instead.
   */
  logout?: () => void | Promise<void>;
};

/** `DisconnectReason.loggedOut` — the phone unlinked this device. */
export const WHATSAPP_LOGGED_OUT_STATUS = 401;

export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;

/** Exponential backoff: 1s, 2s, 4s … capped at 30s. `attempt` starts at 1. */
export function reconnectDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** (safeAttempt - 1));
}

/**
 * The numeric status code carried by a Baileys disconnect error.
 *
 * Baileys throws `Boom` errors, whose code lives at `error.output.statusCode`;
 * the fallback covers a plain `{ statusCode }` object (and a future Baileys
 * that stops wrapping). Anything else is "unknown", which reconnects.
 */
export function statusCodeFromError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  // Baileys' own shape: every disconnect is a Boom error.
  if (isBoom(error)) return error.output.statusCode;

  const output = (error as { output?: { statusCode?: unknown } }).output;
  if (output && typeof output.statusCode === "number") return output.statusCode;

  const direct = (error as { statusCode?: unknown }).statusCode;
  return typeof direct === "number" ? direct : undefined;
}

export type WhatsAppWorkerDeps = {
  /** Persist status / QR / phone (`setWhatsAppSessionStatus`). */
  setStatus: (
    businessId: string,
    status: WhatsAppSessionState,
    extra?: { qrCode?: string | null; phoneNumber?: string | null },
  ) => Promise<void>;
  /** Delete the stored auth blob after a logout. */
  clearCreds: (businessId: string) => Promise<void>;
  /**
   * Tenants that should have a socket. With `includeConnected`, a worker boot
   * also re-establishes lines that were already open before the restart.
   */
  listRequested: (options: { includeConnected: boolean }) => Promise<string[]>;
  /**
   * Tenants whose owner pressed Disconnect
   * (`WhatsAppSession.logoutRequestedAt` is set). The worker owns the socket,
   * so the API route cannot close it itself: it raises this flag instead.
   */
  listLogoutRequests: () => Promise<string[]>;
  /** Clear the flag once the socket is gone. */
  clearLogoutRequest: (businessId: string) => Promise<void>;
  /** Create the socket + auth state + message listener for one tenant. */
  connect: (
    businessId: string,
    onSignal: (signal: WhatsAppSessionSignal) => void,
  ) => Promise<WhatsAppSessionHandle>;
  /** Defaults to `console.info`; pass a no-op in tests. */
  log?: (message: string, ...args: unknown[]) => void;
  /** Injectable timers so tests do not wait for real backoff. */
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
  setIntervalFn?: (fn: () => void, ms: number) => unknown;
  clearIntervalFn?: (handle: unknown) => void;
};

/**
 * Owns the socket map for every tenant in one process.
 *
 * One instance per worker process; `start()` sweeps the database and keeps
 * polling, `stop()` closes everything for a clean SIGINT/SIGTERM shutdown.
 */
export class WhatsAppSessionWorker {
  private readonly sessions = new Map<string, WhatsAppSessionHandle>();
  /** `connect()` in flight: prevents two sockets for one tenant. */
  private readonly starting = new Set<string>();
  /**
   * A socket can emit `close` before `connect()` has returned (a failed
   * handshake). Without this, `ensureSession()` would store the dead handle
   * after the fact, and the reconnect timer would see a live session and give
   * up — the tenant would stay offline until the process restarted.
   */
  private readonly closedWhileStarting = new Set<string>();
  private readonly attempts = new Map<string, number>();
  private readonly reconnectTimers = new Map<string, unknown>();
  private pollTimer: unknown = null;
  private pollRunning = false;
  private stopped = false;

  private readonly setTimeoutFn: (fn: () => void, ms: number) => unknown;
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly setIntervalFn: (fn: () => void, ms: number) => unknown;
  private readonly clearIntervalFn: (handle: unknown) => void;
  private readonly log: (message: string, ...args: unknown[]) => void;

  constructor(private readonly deps: WhatsAppWorkerDeps) {
    this.setTimeoutFn = deps.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutFn =
      deps.clearTimeoutFn ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.setIntervalFn = deps.setIntervalFn ?? ((fn, ms) => setInterval(fn, ms));
    this.clearIntervalFn =
      deps.clearIntervalFn ??
      ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));
    this.log = deps.log ?? ((message, ...args) => console.info(message, ...args));
  }

  /** Business ids with a socket in this process (tests + diagnostics). */
  activeBusinessIds(): string[] {
    return [...this.sessions.keys()];
  }

  /**
   * Boot recovery + the polling loop.
   *
   * The first sweep includes CONNECTED rows: a worker restart must pick its
   * open lines back up instead of waiting for someone to change a status. Every
   * later sweep only starts CONNECTING rows (the web app's "connect my
   * WhatsApp" request) and QR_READY rows (a pairing that is still unscanned).
   */
  async start({
    pollIntervalMs = 5_000,
  }: { pollIntervalMs?: number } = {}): Promise<void> {
    // Idempotent: a second `start()` must not add a second interval.
    if (this.pollTimer !== null) return;

    this.stopped = false;
    await this.poll({ includeConnected: true });

    this.pollTimer = this.setIntervalFn(() => {
      void this.poll({ includeConnected: false });
    }, pollIntervalMs);
  }

  /**
   * One sweep. Returns the tenants whose socket was started by this call.
   *
   * Overlapping sweeps are skipped: a slow `connect()` must not put two sockets
   * on the same tenant when the next tick fires.
   */
  async poll({
    includeConnected = false,
  }: { includeConnected?: boolean } = {}): Promise<string[]> {
    if (this.stopped || this.pollRunning) return [];

    this.pollRunning = true;

    try {
      // Logout requests first, and always — including on the boot sweep. The
      // owner may have pressed Disconnect while the worker was down, and a
      // CONNECTING row in the same sweep must not resurrect the old identity.
      try {
        const logoutRequests = await this.deps.listLogoutRequests();

        for (const businessId of logoutRequests) {
          await this.disconnect(businessId);
          await this.deps.clearLogoutRequest(businessId);
        }
      } catch (error) {
        // A worker started before `migrate deploy` has no logout column yet;
        // that must not stop every other tenant's socket from starting.
        this.log("[whatsapp-worker] logout sweep failed", error);
      }

      const businessIds = await this.deps.listRequested({ includeConnected });
      const started: string[] = [];

      for (const businessId of businessIds) {
        if (await this.ensureSession(businessId)) started.push(businessId);
      }

      return started;
    } catch (error) {
      // A database blip must not kill the worker: the next tick retries.
      this.log("[whatsapp-worker] poll failed", error);
      return [];
    } finally {
      this.pollRunning = false;
    }
  }

  /**
   * Open one tenant's socket if it has none. Idempotent: a poll tick, a manual
   * request and a reconnect timer can all land together.
   */
  async ensureSession(businessId: string): Promise<boolean> {
    if (this.stopped) return false;
    if (this.sessions.has(businessId) || this.starting.has(businessId)) {
      return false;
    }

    this.starting.add(businessId);
    // A fresh attempt starts clean: a marker left by a `connect()` that threw
    // must not discard the socket this attempt successfully creates.
    this.closedWhileStarting.delete(businessId);
    this.clearReconnectTimer(businessId);

    try {
      await this.deps.setStatus(businessId, "CONNECTING");

      const handle = await this.deps.connect(businessId, (signal) => {
        void this.handleSignal(businessId, signal);
      });

      // `stop()` may have run while `connect()` was awaiting, and the socket
      // may already have closed. Either way it must not enter the map: the
      // close path has scheduled the retry.
      if (this.stopped || this.closedWhileStarting.delete(businessId)) {
        await this.closeQuietly(handle);
        return false;
      }

      this.sessions.set(businessId, handle);
      return true;
    } catch (error) {
      this.log(
        `[whatsapp-worker] could not open a socket for ${businessId}`,
        error,
      );
      this.scheduleReconnect(businessId);
      return false;
    } finally {
      this.starting.delete(businessId);
    }
  }


  /**
   * Owner-requested disconnect.
   *
   * Closes the live socket (a proper logout when the transport supports it),
   * cancels any backoff, and wipes the stored identity so the next Connect
   * starts from a fresh QR. Safe when no socket is live: a Disconnect pressed
   * while the worker was down is handled on the next sweep.
   */
  async disconnect(businessId: string): Promise<boolean> {
    const handle = this.sessions.get(businessId);

    this.sessions.delete(businessId);
    this.clearReconnectTimer(businessId);
    this.attempts.delete(businessId);
    this.closedWhileStarting.delete(businessId);

    if (handle) {
      try {
        if (handle.logout) await handle.logout();
        else await handle.close();
      } catch (error) {
        this.log(`[whatsapp-worker] logout failed for ${businessId}`, error);
        await this.closeQuietly(handle);
      }
    }

    await this.deps.setStatus(businessId, "DISCONNECTED", {
      qrCode: null,
      phoneNumber: null,
    });
    await this.deps.clearCreds(businessId);

    return Boolean(handle);
  }

  /**
   * Apply one `connection.update` for a tenant.
   *
   * Public so tests (and any future adapter) can drive the state machine
   * without a socket.
   */
  async handleSignal(
    businessId: string,
    signal: WhatsAppSessionSignal,
  ): Promise<void> {
    try {
      // A QR is a pairing attempt: it replaces any previous QR and resets the
      // reconnect counter, because the line is healthy and just needs a scan.
      if (signal.qr) {
        this.attempts.set(businessId, 0);
        await this.deps.setStatus(businessId, "QR_READY", {
          qrCode: signal.qr,
        });
        return;
      }

      if (signal.connection === "open") {
        this.attempts.set(businessId, 0);
        this.clearReconnectTimer(businessId);
        await this.deps.setStatus(businessId, "CONNECTED", {
          qrCode: null,
          phoneNumber: signal.phoneNumber ?? null,
        });
        return;
      }

      if (signal.connection === "close") {
        await this.handleClose(businessId, signal.statusCode);
      }

      // "connecting" is ignored: `ensureSession()` already wrote CONNECTING,
      // and honouring it here would overwrite QR_READY with a less useful state
      // every time the socket redials.
    } catch (error) {
      this.log(
        `[whatsapp-worker] signal handling failed for ${businessId}`,
        error,
      );
    }
  }

  /** Close every socket and stop polling / reconnecting. */
  async stop(): Promise<void> {
    this.stopped = true;

    if (this.pollTimer !== null) {
      this.clearIntervalFn(this.pollTimer);
      this.pollTimer = null;
    }

    for (const timer of this.reconnectTimers.values()) {
      this.clearTimeoutFn(timer);
    }
    this.reconnectTimers.clear();
    this.closedWhileStarting.clear();

    const handles = [...this.sessions.values()];
    this.sessions.clear();

    for (const handle of handles) {
      await this.closeQuietly(handle);
    }
  }

  private async handleClose(
    businessId: string,
    statusCode?: number,
  ): Promise<void> {
    // Record it before the awaiting `connect()` resumes (see the field's doc).
    if (this.starting.has(businessId)) {
      this.closedWhileStarting.add(businessId);
    }

    const handle = this.sessions.get(businessId);

    this.sessions.delete(businessId);
    this.clearReconnectTimer(businessId);
    await this.closeQuietly(handle);

    // Persist DISCONNECTED before deciding what happens next: the dashboard
    // must never show a dead socket as connected while a backoff timer runs.
    await this.deps.setStatus(businessId, "DISCONNECTED", { qrCode: null });

    if (statusCode === WHATSAPP_LOGGED_OUT_STATUS) {
      // The owner unlinked the device (or WhatsApp revoked it). The stored
      // identity is now useless: wipe it so the next CONNECTING request pairs
      // from scratch and shows a fresh QR instead of failing forever.
      this.attempts.delete(businessId);
      await this.deps.clearCreds(businessId);
      this.log(
        `[whatsapp-worker] ${businessId} logged out of WhatsApp; stored credentials wiped`,
      );
      return;
    }

    this.scheduleReconnect(businessId);
  }

  /** Queue one reconnect with exponential backoff (deduped per tenant). */
  private scheduleReconnect(businessId: string): void {
    if (this.stopped || this.reconnectTimers.has(businessId)) return;

    const attempt = (this.attempts.get(businessId) ?? 0) + 1;
    this.attempts.set(businessId, attempt);

    const delay = reconnectDelayMs(attempt);
    this.log(
      `[whatsapp-worker] reconnecting ${businessId} in ${delay}ms (attempt ${attempt})`,
    );

    const timer = this.setTimeoutFn(() => {
      this.reconnectTimers.delete(businessId);
      void this.ensureSession(businessId);
    }, delay);

    this.reconnectTimers.set(businessId, timer);
  }

  private clearReconnectTimer(businessId: string): void {
    const timer = this.reconnectTimers.get(businessId);
    if (timer === undefined) return;

    this.clearTimeoutFn(timer);
    this.reconnectTimers.delete(businessId);
  }

  private async closeQuietly(
    handle: WhatsAppSessionHandle | undefined,
  ): Promise<void> {
    if (!handle) return;

    try {
      await handle.close();
    } catch (error) {
      // Closing a socket that already died is normal; never fail a shutdown.
      this.log("[whatsapp-worker] socket close failed", error);
    }
  }
}

