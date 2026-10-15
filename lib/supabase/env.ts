/**
 * Supabase connection settings, read from the environment.
 *
 * The project URL and the public API key are safe to expose to the browser
 * (the `NEXT_PUBLIC_` prefix makes Next.js inline them into the client bundle).
 * They are read through this helper so a missing configuration fails with a
 * message that says exactly what to add, instead of a confusing
 * "supabaseUrl is required" from inside the SDK.
 */
export function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Supabase renamed the "anon key" to "publishable key" in newer dashboards.
  // The value is the same, so accept either name.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (Supabase dashboard -> " +
        "Project Settings -> API keys), then restart the dev server.",
    );
  }

  return { url, key };
}

/**
 * True when a thrown error is our own "not configured" error.
 *
 * A type guard, so callers can read `error.message` after checking it even
 * though a `catch` binding is `unknown`.
 */
export function isMissingConfigError(error: unknown): error is Error {
  return (
    error instanceof Error && error.message.startsWith("Supabase is not configured")
  );
}
