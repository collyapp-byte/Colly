// Keyset ("cursor") pagination for the dashboard list endpoints.
//
// Every list used to return one fixed page of 50 rows with no way to fetch the
// next one, which silently truncated large catalogues, invoice histories and
// inboxes. The cursor is an opaque base64url JSON object holding the ordering
// keys of the last row on the page, so the next request continues exactly after
// it: `WHERE (createdAt, id) < (cursor.createdAt, cursor.id)` expressed as an
// OR chain Prisma can push down to the (businessId, createdAt) indexes.
//
// Cursors are not secret, only opaque. Never trust their shape: `decodeCursor`
// returns null for anything that is not a flat string map, and the routes fall
// back to the first page.

/** Default rows per page for the list endpoints. */
export const LIST_PAGE_SIZE = 50;

/** Hard ceiling so `?limit=100000` cannot turn a list into a full table scan. */
const MAX_PAGE_SIZE = 100;

/**
 * Reads `?limit=` from the query string, clamped to [1, MAX_PAGE_SIZE].
 * Anything missing, zero, negative or non-numeric falls back to the default.
 */
export function readPageSize(
  searchParams: URLSearchParams,
  fallback: number = LIST_PAGE_SIZE,
): number {
  const raw = Number(searchParams.get("limit"));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), MAX_PAGE_SIZE);
}

/** Encodes the ordering keys of the last row into an opaque cursor string. */
export function encodeCursor(
  values: Record<string, string | number | Date>,
): string {
  const plain: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    plain[key] = value instanceof Date ? value.toISOString() : String(value);
  }
  return Buffer.from(JSON.stringify(plain), "utf8").toString("base64url");
}

/** Decodes a cursor, returning null for missing or malformed input. */
export function decodeCursor(
  raw: string | null,
): Record<string, string> | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof value === "string" || typeof value === "number") {
        values[key] = String(value);
      }
    }

    return Object.keys(values).length > 0 ? values : null;
  } catch {
    return null;
  }
}

/** Reads a date key out of a decoded cursor, or null when absent/invalid. */
export function cursorDate(
  cursor: Record<string, string> | null,
  key: string,
): Date | null {
  const raw = cursor?.[key];
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
