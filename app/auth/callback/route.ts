import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
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
        },
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        // HARDCODED PRODUCTION URL
        return NextResponse.redirect(`https://colly.com.ng${next}`);
      }

      console.error("[AUTH_EXCHANGE_ERROR]", error.message);
    } catch (err) {
      console.error("[AUTH_CALLBACK_CRASH]", err);
    }
  }

  // HARDCODED PRODUCTION URL
  return NextResponse.redirect(
    `https://colly.com.ng/login?error=auth_callback_failed`,
  );
}
