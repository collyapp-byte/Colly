import { createClient } from "./client";

/**
 * Supabase Storage helpers for product images.
 *
 * Both functions use the browser client, so they must only be called from
 * Client Components. Files live in the public `product-images` bucket under a
 * `${businessId}/${productId}/` prefix, which keeps each tenant's uploads
 * separate.
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
