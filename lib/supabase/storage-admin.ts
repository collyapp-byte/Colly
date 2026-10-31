import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  RECEIPTS_BUCKET,
  contentTypeForFileName,
  sanitizeStoragePath,
} from "./storage-path";

/**
 * Server-only Supabase Storage helpers.
 *
 * This module authenticates with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses
 * Row Level Security, so it must NEVER be imported from a Client Component —
 * that is why it lives beside the browser helpers in `storage.ts` instead of
 * inside them (`components/products/product-form-modal.tsx` imports that file,
 * and a single careless import would drag the service key into the client
 * bundle graph). Call it from Route Handlers, Server Actions and pipelines.
 */

/** Supabase Storage rejects anything larger than this on the free plan. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Buckets this process has already created or confirmed. A warm serverless
 * instance skips the round trip after the first upload.
 */
const ensuredBuckets = new Set<string>();

/** True when both the project URL and the service-role key are configured. */
export function isStorageAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Service-role Supabase client. Create it per call: it holds no session state,
 * but a shared module-level client keeps connections open across requests.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL " +
        "and SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard -> Project Settings " +
        "-> API keys) in .env.local, then restart the dev server.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Uploads a buffer with the service role and returns its public URL.
 *
 * The bucket is created on first use as a public bucket, because the vision
 * pipeline and the invoices page both read the object straight from its URL.
 * An existing bucket is left untouched, so a manually configured policy or
 * size limit is never overwritten.
 *
 * @param fileBuffer bytes to store (Telegram hands us an `ArrayBuffer`)
 * @param fileName   object key, e.g. `{businessId}/{chatId}/{stamp}.jpg`
 * @param bucketName target bucket; defaults to the receipts bucket
 */
export async function uploadFileToSupabase(
  fileBuffer: ArrayBuffer | Uint8Array,
  fileName: string,
  bucketName: string = RECEIPTS_BUCKET,
): Promise<string> {
  const byteLength = fileBuffer.byteLength;

  if (byteLength === 0) {
    throw new Error("Refusing to upload an empty file.");
  }

  if (byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Refusing to upload ${byteLength} bytes; the limit is ${MAX_UPLOAD_BYTES}.`,
    );
  }

  const path = sanitizeStoragePath(fileName);
  const bucket = bucketName.trim() || RECEIPTS_BUCKET;
  const supabase = createAdminClient();

  await ensurePublicBucket(supabase, bucket);

  const { error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    contentType: contentTypeForFileName(path),
    upsert: false,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Storage upload succeeded but no public URL was returned.");
  }

  return data.publicUrl;
}

/**
 * Makes sure `bucket` exists and is public. A concurrent upload that created it
 * first is not an error ("already exists"), so that message is swallowed.
 */
async function ensurePublicBucket(
  supabase: SupabaseClient,
  bucket: string,
): Promise<void> {
  if (ensuredBuckets.has(bucket)) {
    return;
  }

  const existing = await supabase.storage.getBucket(bucket);

  if (existing.data) {
    ensuredBuckets.add(bucket);
    return;
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
  });

  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Could not create the "${bucket}" bucket: ${error.message}`);
  }

  ensuredBuckets.add(bucket);
}
