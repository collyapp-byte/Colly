import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (code) {
    try {
      const cookieStore = await cookies();
      const { url, key } = getSupabaseEnv();
      const supabase = createServerClient(url, key, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(`${appUrl}${next}`);
      }

      console.error("[AUTH_EXCHANGE_ERROR]", error.message);
    } catch (err) {
      console.error("[AUTH_CALLBACK_CRASH]", err);
    }
  }

  return NextResponse.redirect(
    `${appUrl}/login?error=auth_callback_failed`,
  );
}
