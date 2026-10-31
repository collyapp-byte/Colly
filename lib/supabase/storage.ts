import { createClient } from "./client";
import { avatarObjectPath } from "./storage-path";

/**
 * Supabase Storage helpers for product images and the business profile picture.
 *
 * Both functions use the browser client, so they must only be called from
 * Client Components. Files live in the public `product-images` bucket under a
 * `${businessId}/${productId}/` prefix, which keeps each tenant's uploads
 * separate. The business profile picture uses the same bucket under
 * `${businessId}/avatar/` — one picture per tenant, shown by the web chat header.
 */
const BUCKET = "product-images";

/**
 * Uploads a single image and returns its public URL.
 *
 * The key is namespaced by business and product, and prefixed with a timestamp
 * so re-uploading a file with the same name never clobbers an existing object.
 */
export async function uploadProductImage(
  businessId: string,
  productId: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const path = `${businessId}/${productId}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Deletes an image by its public URL. Non-bucket URLs are ignored, so a stale
 * or hand-edited value is a safe no-op.
 */
export async function deleteProductImage(url: string): Promise<void> {
  const path = publicUrlToPath(url);
  if (!path) {
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Uploads a business profile picture and returns its public URL.
 *
 * The key is `{businessId}/avatar/{timestamp}-{name}.{ext}` (see
 * `avatarObjectPath()`), so a re-upload never clobbers the previous picture and
 * the tenant prefix check in `PATCH /api/business` can prove the URL belongs to
 * the caller. The caller stores the returned URL on `Business.avatarUrl`.
 */
export async function uploadBusinessAvatar(
  businessId: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const path = avatarObjectPath({
    businessId,
    extension: file.name.split(".").pop() ?? "jpg",
    unique: `${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}`,
  });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Deletes a business profile picture by its public URL. A URL that is not in this
 * bucket is a safe no-op, like `deleteProductImage()`.
 */
export async function deleteBusinessAvatar(url: string): Promise<void> {
  const path = publicUrlToPath(url);
  if (!path) {
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}

/** Extracts the object key from a public URL, or null when it is not ours. */
function publicUrlToPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);

  if (index === -1) {
    return null;
  }

  const encoded = url.slice(index + marker.length).split("?")[0];

  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}
