"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { signup } from "@/lib/auth-actions";
import { INITIAL_AUTH_STATE, emailVerificationMessage } from "@/lib/auth-form";
import { isStrongPassword, WEAK_PASSWORD_MESSAGE } from "@/lib/validators";
import { createClient } from "@/lib/supabase/client";
import type { Channel } from "@/lib/business";
import { AuthAlert, AuthField } from "@/components/auth/auth-form";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";

const TELEGRAM_OPTION = {
  value: "TELEGRAM" as Channel,
  title: "Telegram",
  badge: "Instant Setup",
  bullets: [
    "2,000 messages / month",
    "₦10 per extra message",
    "No SIM card required",
    "Instant self-serve setup",
  ],
};

/** WhatsApp is postponed until Meta business verification clears. */
const WHATSAPP_OPTION = {
  title: "WhatsApp",
  badge: "Coming Soon",
  note: "Pending Meta business verification.",
};

/**
 * The business half of the signup flow: profile, channel choice and password.
 * Submitted through the `signup` server action, which creates the auth user,
 * the Business row (with the chosen channel) and the owner User row.
 *
 * `selectedPlan` is the tier the customer picked on the pricing page
 * ("?plan=green"). It rides along with the form so the server can store it on
 * the Business row and the billing page can pre-select that plan.
 */
export function BusinessSignupForm({
  referredBy,
  selectedPlan,
}: {
  referredBy?: string;
  selectedPlan?: string;
}) {
  const [state, formAction, pending] = useActionState(
    signup,
    INITIAL_AUTH_STATE,
  );
  const [showPassword, setShowPassword] = useState(false);

  // Google sign-ups land here already authenticated by Supabase. In that case
  // the email and password fields are pointless (and a password would never be
  // used), so the form only asks for the business details.
  const [isOAuth, setIsOAuth] = useState(false);
  const [oauthEmail, setOauthEmail] = useState("");
  const [oauthName, setOauthName] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active || !session?.user) return;

        const metadata = session.user.user_metadata ?? {};
        const fullName =
          typeof metadata.full_name === "string"
            ? metadata.full_name
            : typeof metadata.name === "string"
              ? metadata.name
              : "";

        setIsOAuth(true);
        setOauthEmail(session.user.email ?? "");
        setOauthName(fullName);
      } catch {
        // Missing Supabase config or no session: use the normal signup form.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Client-side password strength check. The server action re-checks the same
  // rule, so this is a convenience rather than the security boundary. OAuth
  // users have no password to check.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isOAuth) return;

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");

    if (typeof password !== "string" || !isStrongPassword(password)) {
      event.preventDefault();
      toast.error(WEAK_PASSWORD_MESSAGE);
    }
  }

  // Email confirmation required: replace the form with a "check your email"
  // screen instead of sending the user to the dashboard.
  if (state.requiresEmailVerification || state.notice) {
    return (
      <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl text-gray-900">Check your email</h1>
        <div className="mt-6">
          <AuthAlert tone="success">
            {state.requiresEmailVerification
              ? emailVerificationMessage(state.email ?? "")
              : state.notice}
          </AuthAlert>
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
      <h1 className="font-display text-2xl text-gray-900">
        {isOAuth ? "Finish setting up your business" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isOAuth
          ? `You're signed in with Google${
              oauthEmail ? ` as ${oauthEmail}` : ""
            }. Just tell us about your business.`
          : "Set Colly up for your business. It takes a minute."}
      </p>

      {!isOAuth ? (
        <>
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
        </>
      ) : null}

      <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField
          id="businessName"
          label="Business name"
          name="businessName"
          placeholder="ABC Electronics"
          autoComplete="organization"
        />
        <AuthField
          key={oauthName}
          id="ownerName"
          label="Your name"
          name="ownerName"
          placeholder="Ada Obi"
          autoComplete="name"
          defaultValue={oauthName}
        />
        {!isOAuth ? (
          <AuthField
            id="email"
            label="Email"
            name="email"
            type="email"
            placeholder="you@business.com"
            autoComplete="email"
          />
        ) : null}
        <AuthField
          id="phone"
          label="Business Phone Number"
          name="phone"
          type="tel"
          placeholder="+2348012345678"
          autoComplete="tel"
          hint="Your primary business contact number. (You will connect your AI line in the next step)."
        />

        {/* The tier picked on the pricing page (?plan=green). Hidden so it is
            submitted with the form and stored on the Business row. */}
        {selectedPlan ? (
          <input type="hidden" name="plan" value={selectedPlan} />
        ) : null}

        {/* Channel choice: Telegram is the only channel at launch. WhatsApp is
            shown disabled until Meta verification clears. The hidden input
            keeps submitting channel: "TELEGRAM" to the backend. */}
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-gray-700">
            Which channel do you want to use?
          </legend>
          <input type="hidden" name="channel" value={TELEGRAM_OPTION.value} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Telegram — the only clickable option */}
            <label className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-[#FF6600] bg-orange-50/50 p-4 ring-1 ring-[#FF6600] transition-colors">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="channelChoice"
                    value={TELEGRAM_OPTION.value}
                    checked
                    readOnly
                    className="h-4 w-4 shrink-0 accent-[#FF6600]"
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {TELEGRAM_OPTION.title}
                  </span>
                </span>

                {TELEGRAM_OPTION.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-[#FF6600] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    {TELEGRAM_OPTION.badge}
                  </span>
                )}
              </span>

              <ul className="space-y-1.5 pr-2">
                {TELEGRAM_OPTION.bullets.map((bullet) => (
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

            {/* WhatsApp — disabled, coming soon */}
            <div
              aria-disabled="true"
              className="relative flex cursor-not-allowed flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 opacity-70"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="channelChoice"
                    value="WHATSAPP"
                    disabled
                    className="h-4 w-4 shrink-0 accent-gray-400"
                  />
                  <span className="text-sm font-semibold text-gray-400">
                    {WHATSAPP_OPTION.title}
                  </span>
                </span>

                <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-gray-200 px-2.5 py-0.5 text-[10px] font-bold text-gray-600 shadow-sm">
                  {WHATSAPP_OPTION.badge}
                </span>
              </span>

              <p className="text-sm text-gray-400">{WHATSAPP_OPTION.note}</p>
            </div>
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
        {!isOAuth ? (
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
        ) : null}

        {state.error && <AuthAlert tone="error">{state.error}</AuthAlert>}

        <Button type="submit" variant="primary" loading={pending} className="w-full">
          {isOAuth ? "Create Business Profile" : "Create account"}
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
