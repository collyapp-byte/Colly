import { redirect } from "next/navigation";
import type { Agent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Agent authentication, parallel to `lib/auth.ts`.
 *
 * Agents are a separate identity from business owners: they have their own
 * Supabase session mapping (`Agent.supabaseUserId`) and their own dashboard.
 * Deliberately kept out of `lib/auth.ts` so the two never share a lookup and an
 * agent can never be mistaken for a business owner (or vice versa).
 */

type SupabaseUser = { id: string; email: string | null };

/**
 * Reads the Supabase session for the current request. Returns null when nobody
 * is signed in. Mirrors the private helper in `lib/auth.ts`.
 */
async function getSupabaseUser(): Promise<SupabaseUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id, email: user.email ?? null } : null;
}

/**
 * Maps a Supabase user to an `Agent` row.
 *
 * Matched on `supabaseUserId`, falling back to an unclaimed row (an invited or
 * seeded agent) with the same email, which is then linked. Only rows with a null
 * `supabaseUserId` can be adopted, so an email already tied to another identity
 * is never re-linked.
 */
async function loadAgent(authUser: SupabaseUser): Promise<Agent | null> {
  let row = await prisma.agent.findFirst({
    where: { supabaseUserId: authUser.id },
  });

  if (!row && authUser.email) {
    const unclaimed = await prisma.agent.findFirst({
      where: { email: authUser.email, supabaseUserId: null },
    });

    if (unclaimed) {
      row = await prisma.agent.update({
        where: { id: unclaimed.id },
        data: { supabaseUserId: authUser.id },
      });
    }
  }

  return row;
}

/**
 * The signed-in agent, or null when there is no session or the session has no
 * Agent row yet. Used where "no agent" is a normal outcome (API routes answer
 * with 401).
 */
export async function getCurrentAgent(): Promise<Agent | null> {
  const authUser = await getSupabaseUser();
  if (!authUser) return null;

  const agent = await loadAgent(authUser);

  if (!agent) {
    console.warn(
      `[agent-auth] Supabase user ${authUser.id} (${authUser.email ?? "no email"}) is signed in but has no Agent row. ` +
        "Sign the account up through /agents/signup.",
    );
  }

  return agent;
}

/**
 * The signed-in agent for server-rendered pages.
 *
 * Redirects to /agents/login when there is no session. If a session exists but
 * no Agent row is linked, it throws instead of redirecting: the proxy allows
 * signed-in visitors onto the agent pages, so redirecting to /agents/login could
 * loop for a business owner who happens to be signed in.
 */
export async function requireAgent(): Promise<Agent> {
  const authUser = await getSupabaseUser();

  if (!authUser) {
    redirect("/agents/login");
  }

  const agent = await loadAgent(authUser);

  if (!agent) {
    throw new Error(
      "You are signed in, but no agent account is linked to this account yet. " +
        "Sign up through /agents/signup to create one.",
    );
  }

  return agent;
}
