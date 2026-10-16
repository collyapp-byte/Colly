"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isMissingConfigError } from "@/lib/supabase/env";
import type { AuthFormState } from "@/lib/auth-form";

/**
 * Agent sign-in / sign-out, parallel to `lib/auth-actions.ts`.
 *
 * Signup goes through the API route (`app/api/agents/signup/route.ts`) because
 * it has to create the Supabase user and the Agent row together; login is a
 * server action so the rotated session cookies are written on the redirect.
 */

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Passwords are read verbatim: leading/trailing spaces are part of them. */
function readPassword(formData: FormData): string {
  const value = formData.get("password");
  return typeof value === "string" ? value : "";
}

/**
 * Points the Agent row for `email` at the Supabase user that just signed in.
 *
 * Mirrors `linkTenantToAuthUser` in `lib/auth-actions.ts`: rows are normally
 * claimed by the first sign-in through `loadAgent`, but that only adopts rows
 * that are still unclaimed. Returns whether an Agent row exists for the address
 * so the caller can send accounts without one to /agents/signup.
 */
async function linkAgentToAuthUser(
  email: string,
  supabaseUserId: string,
): Promise<boolean> {
  try {
    const row = await prisma.agent.findUnique({ where: { email } });

    if (!row) {
      console.warn(
        `[agent-login] Supabase user ${supabaseUserId} (${email}) is signed in but has no Agent row. ` +
          "Sending the account to /agents/signup.",
      );
      return false;
    }

    if (row.supabaseUserId === supabaseUserId) return true;

    await prisma.agent.update({
      where: { id: row.id },
      data: { supabaseUserId },
    });

    return true;
  } catch (error) {
    // A lookup that errored says nothing about whether an Agent row exists, so
    // report "linked": a database blip must not hijack a working agent to signup.
    console.error("[agent-login] could not link the agent to the auth user:", error);
    return true;
  }
}

/** Signs an agent in with email and password. */
export async function agentLogin(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email").toLowerCase();
  const password = readPassword(formData);

  if (!email || !password) {
    return { error: "Enter your email and password.", notice: null };
  }

  let hasAgent = true;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[agent-login] supabase:", error.message);
      return { error: agentLoginErrorMessage(error.message), notice: null };
    }

    if (data.user) {
      hasAgent = await linkAgentToAuthUser(email, data.user.id);
    }
  } catch (error) {
    if (isMissingConfigError(error)) {
      return { error: error.message, notice: null };
    }

    console.error("[agent-login]", error);
    return { error: "Could not sign you in. Please try again.", notice: null };
  }

  redirect(hasAgent ? "/agents/dashboard" : "/agents/signup");
}

/** Turns Supabase's auth errors into copy that reads naturally in the form. */
function agentLoginErrorMessage(message: string): string {
  switch (message) {
    case "Invalid login credentials":
      return "Incorrect email or password.";
    case "Email not confirmed":
      return "Confirm your email address first, then sign in.";
    default:
      return message;
  }
}

/** Clears the Supabase session and returns to the agent login page. */
export async function agentLogout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?role=agent");
}
