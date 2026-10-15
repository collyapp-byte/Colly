import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for code that runs in the browser (Client Components).
 *
 * Sessions are stored in cookies so the server can read them too. In a browser
 * runtime `@supabase/ssr` falls back to `document.cookie` when no custom cookie
 * store is passed, which is the pattern the official Next.js docs use.
 *
 * Use this only when you genuinely need the session on the client (for example
 * a realtime subscription). Everything else should go through `lib/auth.ts`,
 * which reads the session on the server.
 */
export function createClient() {
  const { url, key } = getSupabaseEnv();

  return createBrowserClient(url, key);
}
