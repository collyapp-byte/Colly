"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isMissingConfigError } from "@/lib/supabase/env";
import { TRIAL_CONFIG } from "@/lib/plans";
import { isChannel } from "@/lib/business";
import { isValidEmail } from "@/lib/validators";
import type { AuthFormState } from "@/lib/auth-form";

/**
 * `User.password` is still NOT NULL in the database, but Supabase Auth is now
 * the source of truth for credentials. Rows created here store an empty string
 * in that column; it can be dropped in a later migration.
 */
const UNUSED_PASSWORD = "";

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Passwords are read verbatim: leading/trailing spaces are part of them. */
function readPassword(formData: FormData): string {
  const value = formData.get("password");
  return typeof value === "string" ? value : "";
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Creates the Supabase Auth user, then the Business and the owner User row.
 *
 * The tenant rows are matched on email: an account whose rows already exist but
 * isn't linked to a Supabase user yet (an invited owner, or the seeded demo
 * business) is adopted instead of duplicated.
 */
export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const businessName = readField(formData, "businessName");
  const ownerName = readField(formData, "ownerName");
  const email = readField(formData, "email").toLowerCase();
  const phone = readField(formData, "phone");
  const password = readPassword(formData);
  // Optional: the agent who set the business up. Blank on most signups.
  const agentId = readField(formData, "agentId");
  // Channel chosen on the signup form ("WHATSAPP" | "TELEGRAM"); anything
  // missing or unrecognised falls back to the schema default.
  const channelField = readField(formData, "channel");
  const channel = isChannel(channelField) ? channelField : "WHATSAPP";

  if (!businessName || !ownerName || !email || !phone || !password) {
    return { error: "Please fill in every field.", notice: null };
  }
  if (!isValidEmail(email)) {
    return { error: "Enter a valid email address.", notice: null };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", notice: null };
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  // Already claimed by a Supabase account: sign in instead of taking it over.
  if (existing?.supabaseUserId) {
    return { error: "That email is already registered. Sign in instead.", notice: null };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: ownerName, business_name: businessName },
      },
    });

    if (error) {
      console.error("[signup] supabase:", error.message);
      return { error: error.message, notice: null };
    }

    if (!data.user) {
      return { error: "Could not create your account. Please try again.", notice: null };
    }

    // Held in a const so the narrowing survives into the transaction callback.
    const authUser = data.user;

    // When the email is already registered Supabase returns a placeholder user
    // with no identities (so the API can't be used to discover which emails
    // exist). Bail out before creating a business for a stranger's account.
    if (authUser.identities && authUser.identities.length === 0) {
      return { error: "That email is already registered. Sign in instead.", notice: null };
    }

    // Optional referral: credit the agent whose ID was entered. An unknown ID is
    // ignored (the signup still succeeds) rather than failing the whole form.
    const referringAgent = agentId
      ? await prisma.agent.findUnique({ where: { agentNumber: agentId } })
      : null;

    if (agentId && !referringAgent) {
      console.warn(
        `[signup] agent ID "${agentId}" doesn't match any agent; continuing without a referral.`,
      );
    }

    if (existing) {
      // Adopt the pre-created tenant: link it to this new auth user.
      await prisma.user.update({
        where: { id: existing.id },
        data: { supabaseUserId: authUser.id },
      });

      // Record the referral on the adopted business when one was given and it
      // doesn't already have a referrer.
      if (referringAgent) {
        await prisma.business.updateMany({
          where: { id: existing.businessId, referredByAgentId: null },
          data: {
            referredByAgentId: referringAgent.id,
            commissionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        });
      }
    } else {
      // A business and its owner must appear together, or neither.
      await prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: businessName,
            phone,
            // Same number for now; a dedicated WhatsApp number can be set later.
            whatsappNumber: phone,
            // Channel picked on the signup form; drives which connection flow
            // the AI Line settings page shows.
            channel,
            // Fresh accounts start the free trial from the moment they sign up,
            // so the billing UI can count down to a real end date. The length
            // comes from TRIAL_CONFIG so there is a single source of truth.
            onboardingEndsAt: new Date(
              Date.now() + TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000,
            ),
            referredByAgentId: referringAgent?.id ?? null,
            // Agents earn 15% for 12 months from signup when they refer a business.
            commissionEndsAt: referringAgent
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : null,
          },
        });

        await tx.user.create({
          data: {
            businessId: business.id,
            email,
            name: ownerName,
            password: UNUSED_PASSWORD,
            role: "owner",
            supabaseUserId: authUser.id,
          },
        });
      });
    }

    // With "Confirm email" enabled in Supabase there is no session yet, so the
    // user has to confirm before they can sign in.
    if (!data.session) {
      return {
        error: null,
        notice:
          "Account created! Please check your email to confirm your address before logging in.",
      };
    }
  } catch (error) {
    if (isMissingConfigError(error)) {
      return { error: error.message, notice: null };
    }
    if (isUniqueViolation(error)) {
      return { error: "That email is already registered. Sign in instead.", notice: null };
    }

    console.error("[signup]", error);
    return { error: "Could not create your account. Please try again.", notice: null };
  }

  redirect("/dashboard");
}

/**
 * Points the tenant row for `email` at the Supabase user that just signed in.
 *
 * Rows are normally claimed by the first sign-in through `loadTenant`, but that
 * only adopts rows that are still unclaimed (`supabaseUserId IS NULL`). A row
 * left pointing at a Supabase user that no longer exists -- the seeded demo
 * tenant after the seed recreated its rows, or an account whose auth user was
 * replaced -- stays unreachable forever otherwise, and the dashboard answers
 * with "signed in, but no business is linked to this account yet".
 *
 * Re-linking here is at least as safe as the render-time adoption in
 * `loadTenant`: Supabase has just checked the password for this exact address.
 *
 * Returns whether the account has a tenant to show. `false` means there is no
 * `User` row for this address at all: the caller sends such an account to
 * /signup, because a dashboard render would answer with "signed in, but no
 * business is linked to this account yet".
 *
 * A failure must not fail the sign-in -- the session is already valid and the
 * render-time lookup gets another chance on the next request -- so problems are
 * only logged.
 */
async function linkTenantToAuthUser(
  email: string,
  supabaseUserId: string,
): Promise<boolean> {
  try {
    const row = await prisma.user.findUnique({ where: { email } });

    if (!row) {
      console.warn(
        `[login] Supabase user ${supabaseUserId} (${email}) is signed in but has no User row. ` +
          "Sending the account to /signup to create its business.",
      );
      return false;
    }

    if (row.supabaseUserId === supabaseUserId) return true;

    await prisma.user.update({
      where: { id: row.id },
      data: { supabaseUserId },
    });

    return true;
  } catch (error) {
    // A lookup that errored says nothing about whether a tenant row exists, so
    // report "linked": a database blip must not hijack a working account to the
    // signup form, and a genuinely unlinked account still lands on /signup on
    // the next sign-in (and on the render-time lookup in `loadTenant`).
    console.error("[login] could not link the tenant to the auth user:", error);
    return true;
  }
}

/** Signs in with email and password. */
export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email").toLowerCase();
  const password = readPassword(formData);

  if (!email || !password) {
    return { error: "Enter your email and password.", notice: null };
  }

  // Whether the account has a tenant. Stays true when Supabase reports no user
  // (which the error branch above already handled) so the fallback stays "/".
  let hasTenant = true;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[login] supabase:", error.message);
      return { error: loginErrorMessage(error.message), notice: null };
    }

    if (data.user) {
      hasTenant = await linkTenantToAuthUser(email, data.user.id);
    }
  } catch (error) {
    if (isMissingConfigError(error)) {
      return { error: error.message, notice: null };
    }

    console.error("[login]", error);
    return { error: "Could not sign you in. Please try again.", notice: null };
  }

  // A Supabase account with no matching User row has no business to show, so it
  // goes to /signup instead of a dashboard whose layout answers with "signed in,
  // but no business is linked to this account yet".
  redirect(hasTenant ? "/dashboard" : "/signup");
}

/** Turns Supabase's auth errors into copy that reads naturally in the form. */
function loginErrorMessage(message: string): string {
  switch (message) {
    case "Invalid login credentials":
      return "Incorrect email or password.";
    case "Email not confirmed":
      return "Please check your email and click the confirmation link before signing in.";
    default:
      return message;
  }
}

/** Clears the Supabase session and returns to the login page. */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
