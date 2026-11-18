import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { unauthorized } from "@hapi/boom";

import {
  createWhatsAppAuthState,
  reviveStoredAuth,
} from "../workers/whatsapp-auth-state";
import {
  reconnectDelayMs,
  statusCodeFromError,
  WhatsAppSessionWorker,
  WHATSAPP_LOGGED_OUT_STATUS,
  type WhatsAppSessionHandle,
  type WhatsAppSessionSignal,
  type WhatsAppWorkerDeps,
} from "../workers/whatsapp-session-manager";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Let every `void promise` chained inside the manager settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

// ---------------------------------------------------------------------------
// Auth state (WhatsAppSession.creds)
// ---------------------------------------------------------------------------

type TestIO = {
  stored: unknown;
  saves: number;
  clears: number;
  load: () => Promise<unknown | null>;
  save: (state: unknown) => Promise<void>;
  clear: () => Promise<void>;
};

function fakeAuthIO(initial: unknown = null): TestIO {
  const io: TestIO = {
    stored: initial,
    saves: 0,
    clears: 0,
    load: async () => io.stored,
    save: async (state) => {
      io.stored = state;
      io.saves += 1;
    },
    clear: async () => {
      io.stored = null;
      io.clears += 1;
    },
  };

  return io;
}

test("a tenant that never paired starts from fresh credentials", async () => {
  const io = fakeAuthIO();
  const auth = await createWhatsAppAuthState(io);

  assert.equal(auth.state.creds.registered, false);
  assert.equal(typeof auth.state.creds.registrationId, "number");
  assert.ok(auth.state.creds.noiseKey);
  assert.equal(typeof auth.state.keys.get, "function");

  // Nothing is written until something changes.
  assert.equal(io.saves, 0);
});

test("the saved blob round-trips Signal keys as Buffers", async () => {
  const io = fakeAuthIO();
  const auth = await createWhatsAppAuthState(io);

  await auth.state.keys.set({
    "pre-key": {
      "1": {
        private: Buffer.from([1, 2, 3]),
        public: Buffer.from([9, 8]),
      },
    },
  } as never);

  // `keys.set` persists the new keys itself (Baileys awaits it), and
  // `saveCreds` writes again for the `creds.update` hook.
  const afterKeys = io.saves;
  assert.ok(afterKeys >= 1);

  await auth.saveCreds();
  assert.equal(io.saves, afterKeys + 1);

  // What Prisma would store is plain JSON: no Buffers may leak into jsonb.
  const encoded = JSON.stringify(io.stored);
  assert.match(encoded, /"type":"Buffer"/);
  assert.doesNotMatch(encoded, /"0":1/);

  // A second worker (restart, new process) revives the same keys.
  const restarted = await createWhatsAppAuthState({
    ...io,
    load: async () => io.stored,
  });
  const keys = await restarted.state.keys.get("pre-key", ["1"]);
  const stored = keys["1"] as { private?: Buffer; public?: Buffer };

  assert.ok(Buffer.isBuffer(stored.private));
  assert.deepEqual(stored.private.toJSON().data, [1, 2, 3]);
  assert.deepEqual(stored.public?.toJSON().data, [9, 8]);

  // A key Baileys deleted (`null`) is gone after a reload.
  await restarted.state.keys.set({ "pre-key": { "1": null } } as never);
  const afterDelete = await createWhatsAppAuthState({
    ...io,
    load: async () => io.stored,
  });
  assert.deepEqual(await afterDelete.state.keys.get("pre-key", ["1"]), {
    "1": undefined,
  });
});

test("a hand-edited or foreign blob is treated as never paired", () => {
  assert.equal(reviveStoredAuth(null), null);
  assert.equal(reviveStoredAuth(undefined), null);
  assert.equal(reviveStoredAuth([]), null);
  assert.equal(reviveStoredAuth("not auth state"), null);
  assert.equal(reviveStoredAuth({ creds: "nope" }), null);
  assert.equal(reviveStoredAuth({ keys: {} }), null);

  const repaired = reviveStoredAuth({ creds: {}, keys: [] });
  assert.ok(repaired);
  // Missing pieces are filled from initAuthCreds() and the key map defaults.
  assert.equal(repaired.creds.registered, false);
  assert.deepEqual(repaired.keys, {});
});

test("clear() wipes the row and a queued save cannot resurrect it", async () => {
  const io = fakeAuthIO();
  const auth = await createWhatsAppAuthState(io);

  await auth.saveCreds();
  assert.ok(io.stored);

  await auth.clear();
  assert.equal(io.stored, null);
  assert.equal(io.clears, 1);

  // The socket may still emit creds.update while it closes; those writes must
  // not bring the deleted identity back.
  await auth.saveCreds();
  assert.equal(io.stored, null);
});

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

type StatusWrite = {
  businessId: string;
  status: string;
  extra?: { qrCode?: string | null; phoneNumber?: string | null };
};

type FakeSession = {
  businessId: string;
  onSignal: (signal: WhatsAppSessionSignal) => void;
  closeCalls: number;
  logoutCalls: number;
};

type FakeTimer = { fn: () => void; ms: number; id: object; cleared: boolean };

function harness(
  options: {
    requested?: string[];
    failConnectFor?: string[];
    connectGate?: Promise<void>;
    logoutRequests?: string[];
  } = {},
) {
  const statuses: StatusWrite[] = [];
  const cleared: string[] = [];
  const sessions: FakeSession[] = [];
  const timeouts: FakeTimer[] = [];
  const intervals: FakeTimer[] = [];
  const requestedCalls: { includeConnected: boolean }[] = [];
  const logs: string[] = [];
  const clearedLogoutRequests: string[] = [];

  let logoutRequests = [...(options.logoutRequests ?? [])];

  const deps: WhatsAppWorkerDeps = {
    setStatus: async (businessId, status, extra) => {
      statuses.push({ businessId, status, extra });
    },
    clearCreds: async (businessId) => {
      cleared.push(businessId);
    },
    listRequested: async (request) => {
      requestedCalls.push(request);
      return options.requested ?? [];
    },
    listLogoutRequests: async () => logoutRequests,
    clearLogoutRequest: async (businessId) => {
      clearedLogoutRequests.push(businessId);
      logoutRequests = logoutRequests.filter((id) => id !== businessId);
    },
    connect: async (businessId, onSignal) => {
      if (options.connectGate) await options.connectGate;
      if (options.failConnectFor?.includes(businessId)) {
        throw new Error("socket refused");
      }

      const session: FakeSession = {
        businessId,
        onSignal,
        closeCalls: 0,
        logoutCalls: 0,
      };
      sessions.push(session);

      const handle: WhatsAppSessionHandle = {
        close: async () => {
          session.closeCalls += 1;
        },
        logout: async () => {
          session.logoutCalls += 1;
        },
      };

      return handle;
    },
    log: (message) => {
      logs.push(message);
    },
    setTimeoutFn: (fn, ms) => {
      const id = {};
      timeouts.push({ fn, ms, id, cleared: false });
      return id;
    },
    clearTimeoutFn: (id) => {
      const timer = timeouts.find((entry) => entry.id === id);
      if (timer) timer.cleared = true;
    },
    setIntervalFn: (fn, ms) => {
      const id = {};
      intervals.push({ fn, ms, id, cleared: false });
      return id;
    },
    clearIntervalFn: (id) => {
      const timer = intervals.find((entry) => entry.id === id);
      if (timer) timer.cleared = true;
    },
  };

  return {
    deps,
    statuses,
    cleared,
    clearedLogoutRequests,
    sessions,
    timeouts,
    intervals,
    requestedCalls,
    logs,
    setLogoutRequests: (ids: string[]) => {
      logoutRequests = [...ids];
    },
  };
}

test("a sweep starts only the requested tenants, once each", async () => {
  const h = harness({ requested: ["biz-1", "biz-2"] });
  const worker = new WhatsAppSessionWorker(h.deps);

  assert.deepEqual(await worker.poll(), ["biz-1", "biz-2"]);
  assert.deepEqual(worker.activeBusinessIds(), ["biz-1", "biz-2"]);
  assert.deepEqual(
    h.statuses.map((write) => write.status),
    ["CONNECTING", "CONNECTING"],
  );

  // The same rows on the next tick must not open a second socket.
  assert.deepEqual(await worker.poll(), []);
  assert.equal(h.sessions.length, 2);
});

test("two concurrent requests for one tenant open one socket", async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const h = harness({ connectGate: gate });
  const worker = new WhatsAppSessionWorker(h.deps);

  const first = worker.ensureSession("biz-1");
  const second = worker.ensureSession("biz-1");

  release();

  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(h.sessions.length, 1);
});

test("a close that lands during connect does not strand the tenant", async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const h = harness({ connectGate: gate });
  const worker = new WhatsAppSessionWorker(h.deps);

  const creating = worker.ensureSession("biz-1");

  // The handshake fails while `connect()` is still awaiting.
  await worker.handleSignal("biz-1", { connection: "close", statusCode: 500 });
  release();

  assert.equal(await creating, false);
  assert.deepEqual(worker.activeBusinessIds(), []);
  // The socket was closed, and exactly one retry is queued.
  assert.equal(h.sessions[0].closeCalls, 1);
  assert.equal(h.timeouts.length, 1);

  // That retry brings the tenant back.
  h.timeouts[0].fn();
  await flush();
  assert.deepEqual(worker.activeBusinessIds(), ["biz-1"]);
});

test("boot recovery re-establishes CONNECTED lines, then polls requests", async () => {
  const h = harness({ requested: ["biz-1"] });
  const worker = new WhatsAppSessionWorker(h.deps);

  await worker.start({ pollIntervalMs: 5_000 });

  // First sweep: a restart must pick up sessions that were already open.
  assert.deepEqual(h.requestedCalls[0], { includeConnected: true });
  assert.equal(h.intervals.length, 1);
  assert.equal(h.intervals[0].ms, 5_000);

  // Later sweeps only start what the web app asked for.
  h.intervals[0].fn();
  await flush();
  assert.deepEqual(h.requestedCalls[1], { includeConnected: false });

  await worker.stop();
  assert.equal(h.intervals[0].cleared, true);
  assert.equal(h.sessions[0].closeCalls, 1);
});

test("a QR is stored as QR_READY and the socket stays open", async () => {
  const h = harness();
  const worker = new WhatsAppSessionWorker(h.deps);

  await worker.ensureSession("biz-1");
  await worker.handleSignal("biz-1", { qr: "2@abc123" });

  assert.deepEqual(h.statuses.at(-1), {
    businessId: "biz-1",
    status: "QR_READY",
    extra: { qrCode: "2@abc123" },
  });
  assert.equal(h.sessions[0].closeCalls, 0);
});


test("an open connection stores the number and clears the QR", async () => {
  const h = harness();
  const worker = new WhatsAppSessionWorker(h.deps);

  await worker.ensureSession("biz-1");
  await worker.handleSignal("biz-1", { qr: "2@abc123" });
  await worker.handleSignal("biz-1", {
    connection: "open",
    phoneNumber: "2348012345678",
  });

  assert.deepEqual(h.statuses.at(-1), {
    businessId: "biz-1",
    status: "CONNECTED",
    extra: { qrCode: null, phoneNumber: "2348012345678" },
  });
});

test("a dropped connection is disconnected and retried with backoff", async () => {
  const h = harness();
  const worker = new WhatsAppSessionWorker(h.deps);

  await worker.ensureSession("biz-1");
  await worker.handleSignal("biz-1", { connection: "close", statusCode: 428 });

  assert.deepEqual(h.statuses.at(-1), {
    businessId: "biz-1",
    status: "DISCONNECTED",
    extra: { qrCode: null },
  });
  assert.equal(h.sessions[0].closeCalls, 1);
  assert.deepEqual(worker.activeBusinessIds(), []);
  assert.equal(h.timeouts.length, 1);
  assert.equal(h.timeouts[0].ms, 1_000);

  // The timer reconnects the tenant.
  h.timeouts[0].fn();
  await flush();
  assert.equal(h.sessions.length, 2);
  assert.deepEqual(worker.activeBusinessIds(), ["biz-1"]);

  // A second failure waits twice as long.
  await worker.handleSignal("biz-1", { connection: "close", statusCode: 500 });
  assert.equal(h.timeouts.at(-1)?.ms, 2_000);
});

test("a logged-out device wipes its credentials instead of retrying", async () => {
  const h = harness();
  const worker = new WhatsAppSessionWorker(h.deps);

  await worker.ensureSession("biz-1");
  await worker.handleSignal("biz-1", {
    connection: "close",
    statusCode: WHATSAPP_LOGGED_OUT_STATUS,
  });

  assert.equal(WHATSAPP_LOGGED_OUT_STATUS, 401);
  assert.deepEqual(h.cleared, ["biz-1"]);
  assert.equal(h.statuses.at(-1)?.status, "DISCONNECTED");
  assert.equal(h.sessions[0].closeCalls, 1);
  assert.deepEqual(worker.activeBusinessIds(), []);
  // No reconnect: the old identity is dead until a fresh QR is requested.
  assert.equal(h.timeouts.length, 0);
  assert.ok(h.logs.some((message) => message.includes("logged out")));
});

test("a disconnect request logs the live socket out and wipes its identity", async () => {
  const h = harness({ requested: ["biz-1"] });
  const worker = new WhatsAppSessionWorker(h.deps);

  await worker.poll();
  assert.deepEqual(worker.activeBusinessIds(), ["biz-1"]);

  // The API writes logoutRequestedAt; the row is no longer CONNECTING.
  h.setLogoutRequests(["biz-1"]);
  h.deps.listRequested = async () => [];

  await worker.poll();

  assert.equal(h.sessions[0].logoutCalls, 1);
  assert.equal(h.sessions[0].closeCalls, 0, "logout replaces a bare close");
  assert.deepEqual(h.cleared, ["biz-1"]);
  assert.deepEqual(h.clearedLogoutRequests, ["biz-1"]);
  assert.deepEqual(worker.activeBusinessIds(), []);
  assert.equal(h.timeouts.length, 0, "a manual logout must not reconnect");
  assert.equal(h.statuses.at(-1)?.status, "DISCONNECTED");
  assert.deepEqual(h.statuses.at(-1)?.extra, {
    qrCode: null,
    phoneNumber: null,
  });
});

test("a disconnect requested while the worker was down is handled on boot", async () => {
  const h = harness({ logoutRequests: ["biz-1"] });
  const worker = new WhatsAppSessionWorker(h.deps);

  await worker.start({ pollIntervalMs: 5_000 });

  // There is no socket to close, but the stored identity is still wiped and
  // the request is cleared so it does not repeat forever.
  assert.equal(h.sessions.length, 0);
  assert.deepEqual(h.cleared, ["biz-1"]);
  assert.deepEqual(h.clearedLogoutRequests, ["biz-1"]);

  await worker.stop();
});

test("a socket that cannot be created is retried, not thrown", async () => {
  const h = harness({ requested: ["biz-1"], failConnectFor: ["biz-1"] });
  const worker = new WhatsAppSessionWorker(h.deps);

  assert.deepEqual(await worker.poll(), []);
  assert.equal(h.sessions.length, 0);
  assert.equal(h.timeouts.length, 1);
  assert.equal(h.timeouts[0].ms, 1_000);
  assert.ok(h.logs.some((message) => message.includes("could not open")));
});

test("a logout-sweep failure cannot stop sessions from starting", async () => {
  const h = harness({ requested: ["biz-1"] });
  h.deps.listLogoutRequests = async () => {
    throw new Error("column does not exist");
  };

  const worker = new WhatsAppSessionWorker(h.deps);

  // e.g. a worker started before `migrate deploy` added the column.
  assert.deepEqual(await worker.poll(), ["biz-1"]);
  assert.ok(
    h.logs.some((message) => message.includes("logout sweep failed")),
  );
});

test("a feed failure leaves the worker running", async () => {
  const h = harness();
  h.deps.listRequested = async () => {
    throw new Error("database unreachable");
  };

  const worker = new WhatsAppSessionWorker(h.deps);
  assert.deepEqual(await worker.poll(), []);
  assert.ok(h.logs.some((message) => message.includes("poll failed")));
});


test("stop() closes every socket and cancels pending reconnects", async () => {
  const h = harness({ requested: ["biz-1", "biz-2"] });
  const worker = new WhatsAppSessionWorker(h.deps);

  await worker.poll();
  await worker.handleSignal("biz-2", { connection: "close", statusCode: 500 });
  assert.equal(h.timeouts.length, 1);
  assert.equal(h.timeouts[0].cleared, false);

  await worker.stop();

  assert.equal(h.timeouts[0].cleared, true);
  assert.deepEqual(worker.activeBusinessIds(), []);
  assert.deepEqual(
    h.sessions.map((session) => session.closeCalls),
    [1, 1],
  );

  // A signal arriving after shutdown must not schedule anything.
  await worker.handleSignal("biz-1", { connection: "close" });
  assert.equal(h.timeouts.length, 1);
});

test("the reconnect backoff doubles and is capped", () => {
  assert.equal(reconnectDelayMs(1), 1_000);
  assert.equal(reconnectDelayMs(2), 2_000);
  assert.equal(reconnectDelayMs(3), 4_000);
  assert.equal(reconnectDelayMs(6), 30_000);
  assert.equal(reconnectDelayMs(99), 30_000);
  // Guard against a zero/negative attempt from a bad counter.
  assert.equal(reconnectDelayMs(0), 1_000);
  assert.equal(reconnectDelayMs(-5), 1_000);
});

test("a Boom disconnect error yields its status code", () => {
  // Baileys throws a real Boom on every disconnect.
  assert.equal(statusCodeFromError(unauthorized()), 401);
  assert.equal(statusCodeFromError({ output: { statusCode: 401 } }), 401);
  assert.equal(statusCodeFromError({ statusCode: 428 }), 428);
  assert.equal(statusCodeFromError(new Error("plain error")), undefined);
  assert.equal(statusCodeFromError(null), undefined);
  assert.equal(statusCodeFromError("nope"), undefined);
  assert.equal(
    statusCodeFromError({ output: { statusCode: "401" } }),
    undefined,
  );
});

// ---------------------------------------------------------------------------
// The worker entry point is wired, not a stub
// ---------------------------------------------------------------------------

test("the worker entry owns the socket and stays out of Next.js", () => {
  const worker = source("workers/whatsapp-worker.ts");

  assert.match(worker, /makeWASocket\(/);
  assert.match(worker, /printQRInTerminal: false/);
  assert.match(worker, /syncFullHistory: false/);
  assert.match(worker, /pino\(\{ level: "silent" \}\)/);
  assert.match(worker, /sock\.ev\.on\("creds\.update"/);
  assert.match(worker, /auth\.saveCreds\(\)/);
  assert.match(worker, /DisconnectReason\.loggedOut/);
  // The dashboard's Disconnect button is honoured by unlinking the device,
  // not merely dropping the socket.
  assert.match(worker, /sock\.logout\(\)/);
  assert.match(worker, /logoutRequestedAt/);

  // The listener must not write connection state too: the worker is the single
  // writer of the session row.
  assert.match(
    worker,
    /attachWhatsAppListener\(\{ sock, businessId, connectionState: false \}\)/,
  );

  // Boot recovery + polling exist.
  assert.match(worker, /poll\(\{ includeConnected: true \}\)/);
  assert.match(worker, /worker\.start\(\{ pollIntervalMs \}\)/);
  assert.match(worker, /setStatus: setWhatsAppSessionStatus/);

  // It must not be a route handler.
  assert.doesNotMatch(worker, /from "next\//);
});

test("the adapter can hand connection state to the worker alone", () => {
  const adapter = source("lib/whatsapp-session.ts");

  assert.match(adapter, /connectionState = true/);
  assert.match(adapter, /if \(!connectionState\) return;/);
});

test("the worker script is runnable from package.json", () => {
  const pkg = JSON.parse(source("package.json")) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  };

  assert.equal(
    pkg.scripts["worker:whatsapp"],
    "tsx workers/whatsapp-worker.ts",
  );
  assert.ok(pkg.dependencies["@whiskeysockets/baileys"]);
  assert.ok(pkg.dependencies["@hapi/boom"]);
  assert.ok(pkg.dependencies.pino);
});

