import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // The public production origin is required. Never silently fall back to
  // localhost: a deployed OAuth callback must return to the real domain.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for the auth callback redirect.",
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${appUrl}/dashboard`);
    }
  }

  return NextResponse.redirect(`${appUrl}/login?error=auth_callback_failed`);
}
