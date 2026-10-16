"use client";

import Link from "next/link";
import { Suspense, useActionState, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { logout, signup } from "@/lib/auth-actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth-form";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";
import { AuthAlert, AuthField } from "@/components/auth/auth-form";
import { RoleChooser, type AuthRole } from "@/components/auth/role-chooser";
import { Button } from "@/components/ui/button";

type View = "chooser" | AuthRole;

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

/** `?role=business|agent` skips the chooser; anything else shows it. */
function viewFromParam(value: string | null): View {
  return value === "business" || value === "agent" ? value : "chooser";
}

function BusinessSignupForm() {
  const [state, formAction, pending] = useActionState(
    signup,
    INITIAL_AUTH_STATE,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl text-gray-900">Create your account</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set Colly up for your business. It takes a minute.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <AuthField
          id="businessName"
          label="Business name"
          name="businessName"
          placeholder="ABC Electronics"
          autoComplete="organization"
        />
        <AuthField
          id="ownerName"
          label="Your name"
          name="ownerName"
          placeholder="Ada Obi"
          autoComplete="name"
        />
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          placeholder="you@business.com"
          autoComplete="email"
        />
        <AuthField
          id="phone"
          label="Business phone"
          name="phone"
          type="tel"
          placeholder="+2348012345678"
          autoComplete="tel"
        />
        <div>
          <label
            htmlFor="agentId"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Agent ID{" "}
            <span className="font-normal text-gray-400">
              (if someone set you up)
            </span>
          </label>
          <input
            id="agentId"
            name="agentId"
            type="text"
            placeholder="AG-0001"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
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

        {state.error && <AuthAlert tone="error">{state.error}</AuthAlert>}
        {state.notice && <AuthAlert tone="success">{state.notice}</AuthAlert>}

        <Button type="submit" variant="primary" loading={pending} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login?role=business"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Sign in
        </Link>
      </p>

      <form action={logout} className="mt-4 border-t border-gray-200 pt-4 text-center">
        <button
          type="submit"
          className="text-sm font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Not you? Sign out
        </button>
      </form>
    </div>
  );
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "done"; notice: string };

function AgentSignupForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setState({ kind: "submitting" });

    try {
      const response = await fetch("/api/agents/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.get("fullName"),
          email: data.get("email"),
          phone: data.get("phone"),
          state: data.get("state"),
          password: data.get("password"),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; needsConfirmation?: boolean; agentNumber?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setState({
          kind: "error",
          message: payload?.error ?? "Could not create your account. Please try again.",
        });
        return;
      }

      if (payload.needsConfirmation) {
        setState({
          kind: "done",
          notice:
            "Check your email to confirm your account, then sign in to start your training.",
        });
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

  if (state.kind === "done") {
    return (
      <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl text-gray-900">You are almost in</h1>
        <div className="mt-6">
          <AuthAlert tone="success">{state.notice}</AuthAlert>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          <Link
            href="/login?role=agent"
            className="font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Go to sign in
          </Link>
        </p>
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
              minLength={8}
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

function SignupContent() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>(() =>
    viewFromParam(searchParams.get("role")),
  );

  return (
    <div>
      {view !== "chooser" && (
        <button
          type="button"
          onClick={() => setView("chooser")}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-colly"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      )}

      {view === "chooser" && <RoleChooser variant="signup" onSelect={setView} />}
      {view === "business" && <BusinessSignupForm />}
      {view === "agent" && <AgentSignupForm />}
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <SignupContent />
    </Suspense>
  );
}
