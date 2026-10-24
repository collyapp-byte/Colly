"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: "https://colly.com.ng/reset-password" },
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl text-gray-900">Forgot password?</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter your email and we will send you a reset link.
      </p>

      {sent ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Check your email for a password reset link.
          </div>
          <Link
            href="/login"
            className="inline-flex text-sm font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="forgot-email" className={LABEL_CLASS}>
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@business.com"
              autoComplete="email"
              required
              className={INPUT_CLASS}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            loading={sending}
            className="w-full"
          >
            Send reset link
          </Button>

          <Link
            href="/login"
            className="text-center text-sm font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  );
}
