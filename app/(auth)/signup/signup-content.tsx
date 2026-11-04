"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";
import type { Industry } from "@/lib/business";
import { isPlanTierName } from "@/lib/plans";
import { trackEvent } from "@/lib/analytics";
import { isStrongPassword, WEAK_PASSWORD_MESSAGE } from "@/lib/validators";
import { createClient } from "@/lib/supabase/client";
import { AuthAlert } from "@/components/auth/auth-form";
import { BusinessSignupForm } from "@/components/auth/business-signup-form";
import { Button } from "@/components/ui/button";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "done"; email: string };

function AgentSignupForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  // AUTO-REDIRECT MAGIC: As soon as the account is created, go to the OTP screen
  useEffect(() => {
    if (state.kind === "done" && state.email) {
      router.replace(`/verify-email?email=${encodeURIComponent(state.email)}`);
    }
  }, [state, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const password = data.get("password");
    if (typeof password !== "string" || !isStrongPassword(password)) {
      toast.error(WEAK_PASSWORD_MESSAGE);
      return;
    }

    const email = data.get("email") as string;
    setState({ kind: "submitting" });

    try {
      const response = await fetch("/api/agents/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.get("fullName"),
          email: email,
          phone: data.get("phone"),
          state: data.get("state"),
          password: data.get("password"),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; needsConfirmation?: boolean; agentNumber?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        // If the error indicates the email is already registered, push them to the verify screen
        if (payload?.error?.toLowerCase().includes("already registered") || payload?.error?.toLowerCase().includes("already exists")) {
           router.push(`/verify-email?email=${encodeURIComponent(email)}`);
           return;
        }
        setState({
          kind: "error",
          message: payload?.error ?? "Could not create your account. Please try again.",
        });
        return;
      }

      trackEvent("signup", { role: "agent" });

      if (payload.needsConfirmation) {
        // This triggers the useEffect above to redirect
        setState({ kind: "done", email: email });
        return;
      }

      router.push("/agents/dashboard");
    } catch {
      setState({
        kind: "error",
        message: "Could not reach the server. Check your connection and try again.",
      });
    }
  }

  // Show a brief loading state while the redirect happens
  if (state.kind === "done") {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
        <p className="text-gray-500 text-sm">Redirecting to verification...</p>
      </div>
    );
  }

  const pending = state.kind === "submitting";

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl text-gray-900">
        Become a Colly agent
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Learn how to set Colly up for businesses, get certified, and grow your
        referrals.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="fullName" className={LABEL_CLASS}>
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            placeholder="Ada Obi"
            autoComplete="name"
            required
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="email" className={LABEL_CLASS}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="phone" className={LABEL_CLASS}>
            Phone <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+2348012345678"
            autoComplete="tel"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="state" className={LABEL_CLASS}>
            State <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <select id="state" name="state" defaultValue="" className={INPUT_CLASS}>
            <option value="">Select your state</option>
            {NIGERIAN_STATES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="password" className={LABEL_CLASS}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {state.kind === "error" && (
          <AuthAlert tone="error">{state.message}</AuthAlert>
        )}

        <Button type="submit" variant="primary" loading={pending} className="w-full">
          Create agent account
        </Button>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        Already an agent?{" "}
        <Link
          href="/login?role=agent"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

function SignupContent({ industry }: { industry: Industry | null }) {
  const searchParams = useSearchParams();
  const isAgentSignup = searchParams.get("role") === "agent";
  const isFresh = searchParams.get("fresh") === "true";

  useEffect(() => {
    if (!isFresh) return;
    const supabase = createClient();
    void supabase.auth.signOut();
  }, [isFresh]);

  const referredBy = (searchParams.get("ref") ?? "").trim();
  const planParam = (searchParams.get("plan") ?? "").trim();
  const selectedPlan = isPlanTierName(planParam) ? planParam : "";

  return (
    <div>
      {isAgentSignup ? (
        <AgentSignupForm />
      ) : (
        <BusinessSignupForm
          referredBy={referredBy}
          selectedPlan={selectedPlan}
          industry={industry}
        />
      )}
    </div>
  );
}

export default function SignupClient({
  industry = null,
}: {
  industry?: Industry | null;
}) {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <SignupContent industry={industry} />
    </Suspense>
  );
}