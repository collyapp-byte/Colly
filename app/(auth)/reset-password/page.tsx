"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.push("/dashboard"), 2000);
    return () => clearTimeout(timer);
  }, [success, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl text-gray-900">Reset password</h1>
      <p className="mt-1 text-sm text-gray-500">
        Choose a new password for your account.
      </p>

      {success ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Password updated. Taking you to your dashboard…
          </div>
          <Link
            href="/dashboard"
            className="inline-flex text-sm font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Go to dashboard
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            loading={saving}
            className="w-full"
          >
            Update password
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
