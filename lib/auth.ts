import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent-auth";
import {
  STAFF_DENIED_MESSAGE,
  STAFF_DENIED_REDIRECT,
  STAFF_DENIED_VALUE,
  type TeamRole,
} from "@/lib/team";

/**
 * The signed-in user, joined with the tenant they belong to.
 *
 * `role` is OWNER for the account that created the business (the `User` row) and
 * STAFF for an invited `TeamMember`. `id` is the id of whichever row the session
 * was matched on — `User.id` for an owner, `TeamMember.id` for staff — so it
 * identifies the account, not the tenant; always scope queries with
 * `businessId`.
 */
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: TeamRole;
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
 * Maps a Supabase user to our own `User` row and its `Business` — the OWNER
 * path.
 *
 * The rows are matched on `supabaseUserId`. Accounts created outside the signup
 * flow (an invited owner, the seeded demo tenant) have no link yet, so we fall
 * back to the email and store the link for next time. Only unclaimed rows
 * (supabaseUserId is null) can be adopted this way, so an email that already
 * belongs to a different auth identity is never re-linked.
 */
async function loadOwner(authUser: SupabaseUser): Promise<AuthUser | null> {
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
    role: "OWNER",
    businessId: row.businessId,
    businessName: row.business.name,
    businessPhone: row.business.phone,
  };
}

/**
 * Maps a Supabase user to an invited `TeamMember` row and its `Business` — the
 * STAFF path.
 *
 * Invited staff sign in with their own Supabase account and never get a `User`
 * row, so the only link is the email the owner filled in on the invite. The
 * address is matched case-insensitively because Supabase normalises it on
 * sign-in while an invite may have been typed with capitals; `TeamMember.email`
 * is unique (see schema.prisma), so at most one business can match.
 *
 * `role` is always "STAFF": the `TeamMember.role` column is reserved for finer
 * grained permissions later, and owner rights must come from a `User` row.
 */
async function loadTeamMember(
  authUser: SupabaseUser,
): Promise<AuthUser | null> {
  if (!authUser.email) return null;

  const row = await prisma.teamMember.findFirst({
    where: { email: { equals: authUser.email, mode: "insensitive" } },
    include: { business: true },
  });

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: "STAFF",
    businessId: row.businessId,
    businessName: row.business.name,
    businessPhone: row.business.phone,
  };
}

/**
 * Resolves the tenant for a signed-in account: the owner (`User`) first, then
 * the invited staff (`TeamMember`). Checking the `User` table first means the
 * account that created a business keeps OWNER rights if an owner and a staff
 * invite ever share an address.
 */
async function loadTenant(authUser: SupabaseUser): Promise<AuthUser | null> {
  const owner = await loadOwner(authUser);
  if (owner) return owner;

  return loadTeamMember(authUser);
}

/**
 * The signed-in user plus their business, or null when there is no session (or
 * the session has no tenant attached yet). Used where "no tenant" is a normal,
 * handleable outcome -- mainly the API routes, which answer with 401.
 *
 * The tenant is the owner's `User` row when one matches the session, otherwise
 * an invited `TeamMember` (role STAFF). Both carry the same `businessId`, so
 * every existing caller keeps working for staff without changes.
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
        `[auth] Supabase user ${authUser.id} (${authUser.email ?? "no email"}) is signed in but has no User or TeamMember row. ` +
          "Create the matching Business and User rows, invite the email as a TeamMember, or sign the account up through /signup.",
      );
    }
  }

  return user;
}

/**
 * The tenant id for the current request, or null when signed out.
 *
 * Deliberately role-blind: staff work the same inbox, products and customers as
 * the owner. Owner-only areas go through `requireOwner()` /
 * `requireOwnerApi()` instead.
 */
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
 *
 * The returned `role` is what callers use to tell an OWNER from invited STAFF.
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

/**
 * Owner-only pages (billing, AI line, team management), for Server Components.
 *
 * A STAFF session is sent back to `/dashboard?denied=staff_restricted` — the
 * same destination the proxy uses — so the dashboard can raise the "owner only"
 * toast instead of the staff member seeing a broken page. The proxy already
 * blocks these paths; this guard is the defence in depth for the render path
 * (and keeps the check in one place if a page is added later).
 */
export async function requireOwner(): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.role !== "OWNER") {
    redirect(STAFF_DENIED_REDIRECT);
  }

  return user;
}

/** The owner, or the response an owner-only route handler must send. */
export type OwnerApiResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: Response };

/**
 * Owner-only guard for route handlers and server actions.
 *
 * The proxy intentionally leaves `/api` alone — callers expect JSON, not a 307
 * to /login — so this is what actually stops a staff session from spending the
 * business's money or re-pointing its channel: 401 when signed out, 403 with
 * `STAFF_DENIED_MESSAGE` when the account is STAFF. The tenant always comes from
 * the session, never from the request body.
 */
export async function requireOwnerApi(): Promise<OwnerApiResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Not signed in" }, { status: 401 }),
    };
  }

  if (user.role !== "OWNER") {
    return {
      ok: false,
      response: Response.json(
        { error: STAFF_DENIED_MESSAGE, reason: STAFF_DENIED_VALUE },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user };
}
