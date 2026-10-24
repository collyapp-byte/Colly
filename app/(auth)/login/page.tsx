"use client";

import Link from "next/link";
import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { login, logout } from "@/lib/auth-actions";
import { agentLogin, agentLogout } from "@/lib/agent-auth-actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth-form";
import { AuthAlert, AuthField } from "@/components/auth/auth-form";
import { GoogleButton } from "@/components/auth/google-button";
import { RoleChooser, type AuthRole } from "@/components/auth/role-chooser";
import { Button } from "@/components/ui/button";

type View = "chooser" | AuthRole;

/** `?role=business|agent` skips the chooser; anything else shows it. */
function viewFromParam(value: string | null): View {
  return value === "business" || value === "agent" ? value : "chooser";
}

function BusinessLoginForm() {
  const [state, formAction, pending] = useActionState(login, INITIAL_AUTH_STATE);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl text-gray-900">Welcome back</h1>
      <p className="mt-1 text-sm text-gray-500">
        Sign in to your Colly dashboard.
      </p>

      <div className="mt-6">
        <GoogleButton />
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Or continue with
        </span>
        <span className="h-px flex-1 bg-gray-200" aria-hidden />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          placeholder="you@business.com"
          autoComplete="email"
        />
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
              autoComplete="current-password"
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

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Forgot password?
          </Link>
        </div>

        {state.error && <AuthAlert tone="error">{state.error}</AuthAlert>}

        <Button type="submit" variant="primary" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        New to Colly?{" "}
        <Link
          href="/signup?role=business"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Create an account
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

function AgentLoginForm() {
  const [state, formAction, pending] = useActionState(
    agentLogin,
    INITIAL_AUTH_STATE,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <h1 className="font-display text-2xl text-gray-900">Agent sign in</h1>
      <p className="mt-1 text-sm text-gray-500">
        Sign in to continue your training and manage referrals.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
        />
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
              autoComplete="current-password"
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

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Forgot password?
          </Link>
        </div>

        {state.error && <AuthAlert tone="error">{state.error}</AuthAlert>}

        <Button type="submit" variant="primary" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        Not an agent yet?{" "}
        <Link
          href="/signup?role=agent"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Become an agent
        </Link>
      </p>

      <form
        action={agentLogout}
        className="mt-4 border-t border-gray-200 pt-4 text-center"
      >
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

function LoginContent() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>(() =>
    viewFromParam(searchParams.get("role")),
  );
  const authError =
    searchParams.get("error") === "auth_callback_failed"
      ? "Google sign-in could not be completed. Please try again."
      : null;

  return (
    <div>
      {authError && (
        <div className="mb-3">
          <AuthAlert tone="error">{authError}</AuthAlert>
        </div>
      )}

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

      {view === "chooser" && <RoleChooser variant="login" onSelect={setView} />}
      {view === "business" && <BusinessLoginForm />}
      {view === "agent" && <AgentLoginForm />}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <LoginContent />
    </Suspense>
  );
}
