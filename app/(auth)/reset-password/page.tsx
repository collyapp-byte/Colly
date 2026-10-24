"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

type Step = "verify" | "reset";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("verify");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const token = code.trim();

    if (!trimmedEmail || token.length !== 6) {
      toast.error("Enter your email and the 6-digit code.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token,
        type: "recovery",
      });

      if (error) {
        toast.error(error.message || "Invalid or expired code");
        return;
      }

      toast.success("Code verified. Choose a new password.");
      setStep("reset");
    } catch {
      toast.error("Could not verify the code. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch {
      toast.error("Could not update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl text-gray-900">Reset password</h1>
      <p className="mt-1 text-sm text-gray-500">
        {step === "verify"
          ? "Enter your email and the 6-digit code we sent you."
          : "Choose a new password for your account."}
      </p>

      {step === "verify" ? (
        <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="reset-email" className={LABEL_CLASS}>
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@business.com"
              autoComplete="email"
              required
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="reset-code" className={LABEL_CLASS}>
              6-digit code
            </label>
            <input
              id="reset-code"
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
            loading={saving}
            className="w-full"
          >
            Verify code
          </Button>

          <Link
            href="/forgot-password"
            className="text-center text-sm font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Send a new code
          </Link>
        </form>
      ) : (
        <form onSubmit={handleReset} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="new-password" className={LABEL_CLASS}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className={LABEL_CLASS}>
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              minLength={8}
              required
              className={INPUT_CLASS}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={saving}
            className="w-full"
          >
            Update password
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm text-gray-500">
        <Link
          href="/login"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-gray-200 bg-surface p-6 text-center text-sm text-gray-500 sm:p-8">
          Loading…
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
