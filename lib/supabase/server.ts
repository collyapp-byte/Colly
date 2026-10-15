import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for code that runs on the server: Server Components, Server
 * Actions and Route Handlers.
 *
 * Always create a new client per request; never share one across requests.
 * Reading the session happens lazily, on the first `getUser()` call.
 */
export async function createClient() {
  // In this Next.js version `cookies()` is async.
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // This is safe to ignore because lib/supabase/proxy.ts refreshes the
          // session (and writes the rotated cookies) on every request.
        }
      },
    },
  });
}
