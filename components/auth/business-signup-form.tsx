"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { signup } from "@/lib/auth-actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth-form";
import type { Channel } from "@/lib/business";
import { AuthAlert, AuthField } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";

/** The channels offered at signup, with the facts that differentiate them. */
const CHANNEL_OPTIONS: {
  value: Channel;
  title: string;
  badge?: string;
  bullets: string[];
}[] = [
  {
    value: "WHATSAPP",
    title: "WhatsApp",
    bullets: [
      "500 messages / month",
      "₦20 per extra message",
      "Requires a dedicated new SIM card",
      "Setup takes ~24 hours (via BSP)",
    ],
  },
  {
    value: "TELEGRAM",
    title: "Telegram",
    badge: "Instant Setup",
    bullets: [
      "2,000 messages / month",
      "₦10 per extra message",
      "No SIM card required",
      "Instant self-serve setup",
    ],
  },
];

/**
 * The business half of the signup flow: profile, channel choice and password.
 * Submitted through the `signup` server action, which creates the auth user,
 * the Business row (with the chosen channel) and the owner User row.
 */
export function BusinessSignupForm({ referredBy }: { referredBy?: string }) {
  const [state, formAction, pending] = useActionState(
    signup,
    INITIAL_AUTH_STATE,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [channel, setChannel] = useState<Channel>("TELEGRAM");

  // Email confirmation required: replace the form with a "check your email"
  // screen instead of sending the user to the dashboard.
  if (state.notice) {
    return (
      <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl text-gray-900">Check your email</h1>
        <div className="mt-6">
          <AuthAlert tone="success">{state.notice}</AuthAlert>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          <Link
            href="/login?role=business"
            className="font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

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
          label={
            channel === "TELEGRAM"
              ? "Business Phone Number"
              : "Dedicated AI Line Number"
          }
          name="phone"
          type="tel"
          placeholder="+2348012345678"
          autoComplete="tel"
            hint={
              channel === "TELEGRAM"
                ? "Your primary business contact number. (You will connect your AI line in the next step)."
                : "Enter a new phone number (SIM) for your AI assistant. You will keep your existing WhatsApp number on your phone. This must be different from your personal WhatsApp number."
            }
        />

        {/* Channel choice: saved on the Business row and used by the AI Line
            settings page to show the right connection flow. */}
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-gray-700">
            Which channel do you want to use?
          </legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {CHANNEL_OPTIONS.map((option) => {
              const selected = channel === option.value;
              const isTelegram = option.value === "TELEGRAM";

              return (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-colors ${
                    isTelegram
                      ? selected
                        ? "border-[#FF6600] bg-orange-50/50 ring-1 ring-[#FF6600]"
                        : "border-orange-200 bg-orange-50/50 hover:border-orange-300"
                      : selected
                        ? "border-gray-400 bg-white ring-1 ring-gray-200"
                        : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="channel"
                        value={option.value}
                        checked={selected}
                        onChange={() => setChannel(option.value)}
                        className="h-4 w-4 shrink-0 accent-[#FF6600]"
                      />
                      <span className="text-sm font-semibold text-gray-900">
                        {option.title}
                      </span>
                    </span>

                    {option.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-[#FF6600] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {option.badge}
                      </span>
                    )}
                  </span>

                  <ul className="space-y-1.5 pr-2">
                    {option.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-sm text-gray-600"
                      >
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6600]"
                          aria-hidden
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </label>
              );
            })}
          </div>
        </fieldset>

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
            defaultValue={referredBy}
            readOnly={Boolean(referredBy)}
            className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20 ${
              referredBy ? "cursor-not-allowed bg-gray-50 text-gray-600" : ""
            }`}
          />
          {referredBy && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-success">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Referred by {referredBy}
            </p>
          )}
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
    </div>
  );
}
