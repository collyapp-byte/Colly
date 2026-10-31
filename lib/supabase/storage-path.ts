/**
 * Pure helpers for object keys and MIME types on server-side uploads.
 *
 * Chat channels (Telegram) hand us a picture and a content type, not a browser
 * `File`, so the object key and the `.ext` have to be built by hand. Keeping the
 * rules here — instead of inside `storage-admin.ts` — means they can be unit
 * tested without importing the Supabase SDK, and it guarantees no client
 * bundle ever pulls the service-role module in.
 */

/**
 * Bucket that holds pictures customers send in chat (payment receipts and
 * other proofs). Public, like `product-images`, because Groq Vision fetches the
 * object by URL and the owner opens it from the invoices page.
 */
export const RECEIPTS_BUCKET = "receipts";

/** Longest object key Supabase Storage accepts comfortably. */
const MAX_KEY_LENGTH = 512;

/** Fallback when a channel reports a type we have no extension for. */
const DEFAULT_EXTENSION = "jpg";

/** Content type used when the key has no recognised extension. */
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/** Extensions we are willing to store, mapped to their MIME type. */
const CONTENT_TYPES = new Map<string, string>([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
  ["pdf", "application/pdf"],
]);

/**
 * Extension for the content type a channel reports (`image/jpeg` → `jpg`).
 * Unknown types fall back to `jpg`; callers reject non-images before this.
 */
export function extensionForContentType(contentType: string): string {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  for (const [extension, type] of CONTENT_TYPES) {
    if (type === normalized) {
      return extension;
    }
  }

  return DEFAULT_EXTENSION;
}

/** MIME type for a stored object, derived from its extension. */
export function contentTypeForFileName(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES.get(extension) ?? DEFAULT_CONTENT_TYPE;
}

/**
 * Cleans an object key supplied by a channel.
 *
 * Backslashes become forward slashes, every segment is stripped to
 * `[A-Za-z0-9._-]`, and empty, `.` and `..` segments are dropped — a `..` would
 * otherwise let an upload escape the per-business prefix. An empty result is an
 * error rather than a write to the bucket root.
 */
export function sanitizeStoragePath(fileName: string): string {
  const segments = fileName
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim().replace(/[^A-Za-z0-9._-]/g, "-"))
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..");

  const path = segments.join("/");

  if (path.length === 0) {
    throw new Error("Storage path is empty.");
  }

  if (path.length > MAX_KEY_LENGTH) {
    throw new Error(`Storage path is longer than ${MAX_KEY_LENGTH} characters.`);
  }

  return path;
}

/**
 * Object key for a business's chat profile picture:
 * `{businessId}/avatar/{unique}.{extension}`.
 *
 * Same shape as `receiptObjectPath()`: every upload stays under the tenant's own
 * prefix, and the key is a pure function of its inputs so it is assertable.
 */
export function avatarObjectPath(args: {
  businessId: string;
  extension: string;
  unique: string;
}): string {
  const extension = args.extension.trim().toLowerCase();
  const safeExtension = CONTENT_TYPES.has(extension)
    ? extension
    : DEFAULT_EXTENSION;

  return sanitizeStoragePath(
    `${args.businessId}/avatar/${args.unique}.${safeExtension}`,
  );
}

/** Path every Supabase Storage public object URL starts with. */
const STORAGE_PUBLIC_PATH = "/storage/v1/object/public/";

/**
 * Whether `value` is a public object URL in THIS project's Supabase Storage.
 *
 * Used for anything the app renders or fetches from a URL a user can influence:
 * the voice/image pipelines in `app/api/chat/route.ts` (an unvalidated URL there
 * made the route an SSRF proxy), the business profile picture shown by the public
 * web chat, and the PATCH that stores it. Only
 * `https://<project>.supabase.co/storage/v1/object/public/...` is accepted — the
 * exact shape `lib/supabase/storage.ts` produces for every upload. Anything else
 * (other host, plain http, credentials in the URL, a custom port, a signed or
 * non-storage path) is rejected.
 */
export function isPublicStorageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  // https only: no http, javascript:, data:, file: or protocol-relative forms.
  if (url.protocol !== "https:") return false;
  // Embedded credentials and odd ports are classic SSRF bypasses.
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  // Must be a public object in the storage API, not a signed/internal path.
  if (!url.pathname.startsWith(STORAGE_PUBLIC_PATH)) return false;

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) return false;

  try {
    return url.hostname.toLowerCase() === new URL(projectUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Object key for a picture a customer sent in chat:
 * `{businessId}/{chatKey}/{unique}.{extension}`.
 *
 * `unique` is passed in (rather than generated here) so the key is a pure
 * function of its inputs and stays assertable in tests.
 */
export function receiptObjectPath(args: {
  businessId: string;
  chatKey: string;
  extension: string;
  unique: string;
}): string {
  const extension = args.extension.trim().toLowerCase();
  const safeExtension = CONTENT_TYPES.has(extension)
    ? extension
    : DEFAULT_EXTENSION;

  return sanitizeStoragePath(
    `${args.businessId}/${args.chatKey}/${args.unique}.${safeExtension}`,
  );
}
