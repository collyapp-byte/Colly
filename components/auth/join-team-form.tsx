"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthAlert } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isStrongPassword, WEAK_PASSWORD_MESSAGE } from "@/lib/validators";

// Same field styling as the other auth screens (components/auth/auth-form.tsx).
const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

type JoinTeamFormProps = {
  /** Workspace being joined - `TeamMember.business.name`. */
  businessName: string;
  /** The invited address. Fixed: access is granted by this exact match. */
  email: string;
  /** Display name from the invite, sent to Supabase as `full_name`. */
  name: string;
};

/**
 * Accepts a team invitation: sets a password for the invited address and drops
 * the new staff member straight into the workspace.
 *
 * The address comes from the `TeamMember` row, never from an input, so a
 * visitor cannot turn someone else's invite into an account for their own
 * email. Supabase Auth remains the only authority on accounts; the workspace
 * is resolved server-side by email (`lib/auth.ts#loadTenant`), which is why
 * signing in with a different address would simply not find this team.
 */
export function JoinTeamForm({ businessName, email, name }: JoinTeamFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!isStrongPassword(password)) {
      setError(WEAK_PASSWORD_MESSAGE);
      return;
    }

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (signUpError) {
        setError(signUpError.message || "Could not create your account.");
        return;
      }

      // Supabase answers an address that already has an account with an
      // obfuscated user (no identities) instead of an error, so the invitee is
      // told to sign in rather than being left on a dead form.
      if (data.user && data.user.identities?.length === 0) {
        setError(
          "That address already has a Colly account. Sign in with it instead - your team is already waiting.",
        );
        return;
      }

      // Email confirmation is switched on for this project: there is no session
      // yet, so the invitee confirms first and signs in afterwards.
      if (!data.session) {
        setNotice(
          `Almost there. We sent a confirmation link to ${email} - open it, then sign in and you will land in ${businessName}.`,
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-colly">
        Team invitation
      </p>
      <h1 className="mt-1 font-display text-2xl text-gray-900">
        Join {businessName}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        You were invited as staff. Set a password for{" "}
        <span className="font-medium text-gray-900">{email}</span> and you land
        in the dashboard right away.
      </p>

      {error && (
        <div className="mt-4">
          <AuthAlert tone="error">{error}</AuthAlert>
        </div>
      )}

      {notice && (
        <div className="mt-4">
          <AuthAlert tone="success">{notice}</AuthAlert>
        </div>
      )}

      {notice ? (
        <div className="mt-6">
          <Link
            href="/login?role=business"
            className="font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Go to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="join-password" className={LABEL_CLASS}>
              Password
            </label>
            <input
              id="join-password"
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
            <label htmlFor="join-password-confirm" className={LABEL_CLASS}>
              Confirm password
            </label>
            <input
              id="join-password-confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Type it again"
              autoComplete="new-password"
              minLength={8}
              required
              className={INPUT_CLASS}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            isLoading={saving}
            className="w-full"
          >
            Join the team
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm text-gray-500">
        Already have a Colly account?{" "}
        <Link
          href="/login?role=business"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
