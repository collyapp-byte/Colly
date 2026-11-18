/**
 * Auth state for the WhatsApp worker, persisted in Postgres.
 *
 * Baileys needs two things to stay paired: `creds` (the device identity, the
 * Signal identity, `me`, …) and a key store (pre-keys, sessions, app-state
 * sync keys). `useMultiFileAuthState()` writes both to a JSON file per tenant,
 * which works on one laptop but not for a multi-tenant service: the file is
 * local to the host, invisible to the rest of the system and easy to lose on a
 * redeploy. `WhatsAppSession.creds` is a nullable JSON column on a row that is
 * already unique per business, so the whole blob lives there instead — one
 * tenant, one row, and no filesystem writes from a worker container.
 *
 * The blob is `{ creds, keys }`, encoded with Baileys' own `BufferJSON`
 * replacer/reviver because Signal key material is `Buffer`s and JSON has no
 * binary type. Writes are serialised through a promise queue and always send
 * the complete current state, so a `keys.set` and a `creds.update` landing
 * together cannot overwrite one another with a stale copy.
 *
 * `clear()` is the logged-out path: it stops accepting writes *before* it wipes
 * the row, otherwise a save already queued by the dying socket would recreate
 * the credentials we just deleted.
 */

import {
  BufferJSON,
  initAuthCreds,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalKeyStore,
} from "@whiskeysockets/baileys";

/** `keys` is a two-level map: signal type -> id -> value. */
type StoredSignalKeys = Record<string, Record<string, unknown>>;

export type StoredWhatsAppAuth = {
  creds: AuthenticationCreds;
  keys: StoredSignalKeys;
};

/** How the worker reads/writes the `WhatsAppSession.creds` column. */
export type WhatsAppAuthIO = {
  /** The stored blob, or null when this tenant has never paired. */
  load: () => Promise<unknown | null>;
  save: (state: StoredWhatsAppAuth) => Promise<void>;
  /** Delete the stored blob (device unlinked / logged out). */
  clear: () => Promise<void>;
};

export type WhatsAppAuthHandle = {
  /** What `makeWASocket()` expects. */
  state: AuthenticationState;
  /** Persist the current creds + keys (Baileys' `creds.update` hook). */
  saveCreds: () => Promise<void>;
  /** Wipe the stored blob and ignore anything still queued. */
  clear: () => Promise<void>;
};

/**
 * JSON-safe copy: Buffers become `{ type: "Buffer", data: [...] }`, which is
 * exactly what `BufferJSON.reviver` restores on the way back in.
 */
function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer)) as T;
}

/**
 * Turns a stored column value into auth state.
 *
 * Anything that is not `{ creds: object, keys?: object }` — null, an array, a
 * string left by a hand-edited row — is treated as "never paired", so a bad
 * blob generates a fresh QR instead of crashing the worker for that tenant.
 * Stored creds are spread over `initAuthCreds()` so a row written by an older
 * Baileys version still has the fields the current one expects.
 */
export function reviveStoredAuth(raw: unknown): StoredWhatsAppAuth | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const parsed = JSON.parse(
    JSON.stringify(raw),
    BufferJSON.reviver,
  ) as Partial<StoredWhatsAppAuth> | null;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (!parsed.creds || typeof parsed.creds !== "object") return null;

  const keys =
    parsed.keys && typeof parsed.keys === "object" && !Array.isArray(parsed.keys)
      ? parsed.keys
      : {};

  return { creds: { ...initAuthCreds(), ...parsed.creds }, keys };
}

/** Builds the `AuthenticationState` for one tenant and its persistence hooks. */
export async function createWhatsAppAuthState(
  io: WhatsAppAuthIO,
): Promise<WhatsAppAuthHandle> {
  const stored = reviveStoredAuth(await io.load());
  const creds: AuthenticationCreds = stored?.creds ?? initAuthCreds();
  const keys: StoredSignalKeys = stored?.keys ?? {};

  /** Set by `clear()`: a queued save must not resurrect deleted creds. */
  let cleared = false;
  /** Writes run one at a time, in order, and never stay rejected. */
  let queue: Promise<void> = Promise.resolve();

  const snapshot = (): StoredWhatsAppAuth => toJsonSafe({ creds, keys });

  const persist = (): Promise<void> => {
    if (cleared) return Promise.resolve();

    queue = queue
      .catch(() => undefined)
      .then(() => io.save(snapshot()));

    return queue;
  };

  const keyStore = {
    get: async (type: string, ids: string[]) => {
      const group = keys[type] ?? {};
      const result: Record<string, unknown> = {};

      for (const id of ids) result[id] = group[id];

      return result;
    },
    set: async (data: Record<string, Record<string, unknown> | undefined>) => {
      for (const [type, entries] of Object.entries(data)) {
        if (!entries) continue;

        const group = (keys[type] ??= {});

        for (const [id, value] of Object.entries(entries)) {
          // null is Baileys' "delete this key".
          if (value === null) delete group[id];
          else group[id] = value;
        }
      }

      await persist();
    },
    clear: async () => {
      for (const type of Object.keys(keys)) delete keys[type];
      await persist();
    },
  } as unknown as SignalKeyStore;

  return {
    state: { creds, keys: keyStore },
    saveCreds: persist,
    clear: async () => {
      cleared = true;
      // Let an in-flight save finish, then delete the row value.
      await queue.catch(() => undefined);
      await io.clear();
    },
  };
}
