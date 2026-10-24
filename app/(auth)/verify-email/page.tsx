"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AuthAlert } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";

type VerifyState =
  | { kind: "checking" }
  | { kind: "otp" }
  | { kind: "verified" }
  | { kind: "error"; message: string };

const GENERIC_ERROR =
  "This verification link is invalid or has expired. Enter the 6-digit code from your email below.";

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
  const router = useRouter();
  const emailParam = searchParams.get("email") ?? "";
  const [state, setState] = useState<VerifyState>({ kind: "checking" });
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  // Keep support for older link-based confirmation emails.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function verifyLink() {
      const linkCode = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const paramError = messageFromParams(searchParams);

      if (paramError) {
        setState({ kind: "error", message: paramError });
        return;
      }

      if (!linkCode && !tokenHash) {
        setState({ kind: "otp" });
        return;
      }

      try {
        const supabase = createClient();

        if (linkCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            linkCode,
          );
          if (error) {
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
            setState({ kind: "error", message: GENERIC_ERROR });
            return;
          }
          setState({ kind: "verified" });
        }
      } catch (error) {
        console.error("[verify-email]", error);
        setState({ kind: "error", message: GENERIC_ERROR });
      }
    }

    void verifyLink();
  }, [searchParams]);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const token = code.trim();

    if (!trimmedEmail || token.length !== 6) {
      toast.error("Enter your email and the 6-digit code.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token,
        type: "signup",
      });

      if (error) {
        toast.error(error.message || "Invalid or expired code");
        return;
      }

      toast.success("Email verified!");
      router.push("/dashboard");
    } catch {
      toast.error("Could not verify the code. Please try again.");
    } finally {
      setSubmitting(false);
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
      <h1 className="font-display text-2xl text-gray-900">Verify your email</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter the 6-digit code we sent to your email.
      </p>

      {state.kind === "error" && (
        <div className="mt-6">
          <AuthAlert tone="error">{state.message}</AuthAlert>
        </div>
      )}

      <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@business.com"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20"
          />
        </div>
        <div>
          <label
            htmlFor="otp-code"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            6-digit code
          </label>
          <input
            id="otp-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit code"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.4em] text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          className="w-full"
        >
          Verify email
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
