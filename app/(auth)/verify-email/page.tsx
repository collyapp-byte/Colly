"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AuthAlert, AuthField } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";

/**
 * Landing page for the link in Supabase's confirmation email.
 *
 * Supabase redirects here after hitting its `/auth/v1/verify` endpoint. Two
 * shapes are supported:
 *  - `?code=...` (PKCE flow, the default with @supabase/ssr) — exchanged for a
 *    session, which also signs the user in.
 *  - `?token_hash=...&type=signup` — confirmed through `verifyOtp`.
 *
 * An expired or invalid link arrives as `?error=...&error_code=...`, or the
 * exchange itself fails; either way the page offers to resend the email.
 */

type VerifyState =
  | { kind: "checking" }
  | { kind: "verified" }
  | { kind: "error"; message: string };

const GENERIC_ERROR =
  "This verification link is invalid or has expired. Enter your email below to get a new one.";

function messageFromParams(params: URLSearchParams): string | null {
  const description = params.get("error_description");
  const code = params.get("error_code");
  const error = params.get("error");

  if (description) return `${GENERIC_ERROR} (${description})`;
  if (code) return `${GENERIC_ERROR} (${code})`;
  if (error) return `${GENERIC_ERROR} (${error})`;
  return null;
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>({ kind: "checking" });
  const [resendPending, setResendPending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  // Guards against React StrictMode running the effect twice in dev, which
  // would consume the one-time code twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function verify() {
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const paramError = messageFromParams(searchParams);

      if (paramError) {
        setState({ kind: "error", message: paramError });
        return;
      }

      try {
        const supabase = createClient();

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[verify-email] exchange:", error.message);
            setState({ kind: "error", message: GENERIC_ERROR });
            return;
          }
          setState({ kind: "verified" });
          return;
        }

        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: (type as EmailOtpType | null) ?? "signup",
            token_hash: tokenHash,
          });
          if (error) {
            console.error("[verify-email] verifyOtp:", error.message);
            setState({ kind: "error", message: GENERIC_ERROR });
            return;
          }
          setState({ kind: "verified" });
          return;
        }

        setState({ kind: "error", message: GENERIC_ERROR });
      } catch (error) {
        console.error("[verify-email]", error);
        setState({ kind: "error", message: GENERIC_ERROR });
      }
    }

    void verify();
  }, [searchParams]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get("email");
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) return;

    setResendPending(true);
    setResendNotice(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
      });

      if (error) {
        setState({ kind: "error", message: error.message });
        return;
      }

      setResendNotice(
        "Verification email sent! Check your inbox and click the new link.",
      );
    } catch {
      setState({
        kind: "error",
        message: "Could not reach the server. Check your connection and try again.",
      });
    } finally {
      setResendPending(false);
    }
  }

  if (state.kind === "checking") {
    return (
      <div className="rounded-lg border border-gray-200 bg-surface p-6 text-center text-sm text-gray-500 sm:p-8">
        Verifying your email…
      </div>
    );
  }

  if (state.kind === "verified") {
    return (
      <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl text-gray-900">Email Verified!</h1>
        <div className="mt-6">
          <AuthAlert tone="success">
            Your email address has been confirmed. You&apos;re all set.
          </AuthAlert>
        </div>
        <Link href="/dashboard" className="mt-6 block">
          <Button variant="primary" className="w-full">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl text-gray-900">
        Verification failed
      </h1>
      <div className="mt-6">
        <AuthAlert tone="error">{state.message}</AuthAlert>
      </div>

      <form onSubmit={handleResend} className="mt-6 flex flex-col gap-4">
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          placeholder="you@business.com"
          autoComplete="email"
        />
        {resendNotice && <AuthAlert tone="success">{resendNotice}</AuthAlert>}
        <Button
          type="submit"
          variant="primary"
          loading={resendPending}
          className="w-full"
        >
          Resend Verification Email
        </Button>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        <Link
          href="/login?role=business"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-gray-200 bg-surface p-6 text-center text-sm text-gray-500 sm:p-8">
          Verifying your email…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
