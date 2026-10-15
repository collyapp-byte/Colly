"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { logout, signup } from "@/lib/auth-actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth-form";
import { AuthAlert, AuthField } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
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
          href="/login"
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
