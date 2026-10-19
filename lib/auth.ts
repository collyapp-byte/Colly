import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent-auth";

/** The signed-in user, joined with the tenant they belong to. */
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  businessId: string;
  businessName: string;
  businessPhone: string;
};

type SupabaseUser = { id: string; email: string | null };

/**
 * Reads the Supabase session for the current request.
 * Returns null when nobody is signed in.
 *
 * `getUser()` is used rather than `getSession()` because it validates the
 * access token against Supabase Auth instead of trusting the cookie. (Supabase
 * also offers `getClaims()`, which verifies locally and is faster; that is a
 * safe later optimisation, not a correctness requirement.)
 */
async function getSupabaseUser(): Promise<SupabaseUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id, email: user.email ?? null } : null;
}

/**
 * Maps a Supabase user to our own `User` row and its `Business`.
 *
 * The rows are matched on `supabaseUserId`. Accounts created outside the signup
 * flow (an invited owner, the seeded demo tenant) have no link yet, so we fall
 * back to the email and store the link for next time. Only unclaimed rows
 * (supabaseUserId is null) can be adopted this way, so an email that already
 * belongs to a different auth identity is never re-linked.
 */
async function loadTenant(authUser: SupabaseUser): Promise<AuthUser | null> {
  const include = { business: true } as const;

  let row = await prisma.user.findFirst({
    where: { supabaseUserId: authUser.id },
    include,
  });

  if (!row && authUser.email) {
    const unclaimed = await prisma.user.findFirst({
      where: { email: authUser.email, supabaseUserId: null },
      include,
    });

    if (unclaimed) {
      row = await prisma.user.update({
        where: { id: unclaimed.id },
        data: { supabaseUserId: authUser.id },
        include,
      });
    }
  }

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    businessId: row.businessId,
    businessName: row.business.name,
    businessPhone: row.business.phone,
  };
}

/**
 * The signed-in user plus their business, or null when there is no session (or
 * the session has no tenant attached yet). Used where "no tenant" is a normal,
 * handleable outcome -- mainly the API routes, which answer with 401.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const authUser = await getSupabaseUser();
  if (!authUser) return null;

  const user = await loadTenant(authUser);

  if (!user) {
    const agent = await getCurrentAgent();
    if (agent) {
      console.warn(
        `[auth] Agent ${agent.agentNumber} tried to access business route. ` +
          "Session should redirect to /agents/dashboard.",
      );
    } else {
      console.warn(
        `[auth] Supabase user ${authUser.id} (${authUser.email ?? "no email"}) is signed in but has no User row. ` +
          "Create the matching Business and User rows, or sign the account up through /signup.",
      );
    }
  }

  return user;
}

/** The tenant id for the current request, or null when signed out. */
export async function getCurrentBusinessId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.businessId ?? null;
}

/**
 * The signed-in user plus their business, for server-rendered pages.
 *
 * Redirects to /login when there is no session. If a session exists but no
 * tenant is linked, an Agent session is redirected to /agents/dashboard (agents
 * must never see business pages); any other tenant-less session is redirected
 * to /signup, which lets the owner claim a business instead of hitting a crash
 * screen with no way to sign out. The proxy only bounces signed-in users away
 * from /login (and only when they already have a tenant), so /signup stays
 * reachable and this cannot loop.
 */
export async function requireAuth(): Promise<AuthUser> {
  const authUser = await getSupabaseUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await loadTenant(authUser);

  if (!user) {
    const agent = await getCurrentAgent();
    if (agent) {
      redirect("/agents/dashboard");
    }

    redirect("/signup");
  }

  return user;
}
