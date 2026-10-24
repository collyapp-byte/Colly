import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import { getSupabaseEnv, isMissingConfigError } from "./env";

/** Routes that only signed-out visitors should see. */
const AUTH_PATHS = ["/login", "/signup"];

/**
 * Agent sign-in / signup. Signed-out visitors may reach these; any other
 * `/agents/*` page sends them to the agent login page instead of the business
 * one, so the two audiences never cross.
 */
const AGENT_PUBLIC_PATHS = ["/agents/login", "/agents/signup"];

/**
 * Always-public paths (no session required): the marketing homepage, agent
 * certificate verification, email verification (Supabase redirects here from
 * the confirmation link, while the visitor is still signed out), the agent
 * discovery directory and the legal pages (privacy, terms, account deletion).
 *
 * Note "/" only matches the homepage itself: `matchesPath` appends "/" to each
 * prefix, so the entry becomes "//" and never matches a nested path.
 */
const PUBLIC_PATHS = [
  "/",
  "/auth/callback",
  // Public website chat widget -- embedded on customer sites, so it must open
  // for signed-out visitors (and inside an iframe).
  "/chat",
   "/verify",
   "/verify-email",
   "/forgot-password",
   "/reset-password",
   "/find-an-agent",
  "/privacy",
  "/terms",
  "/account/delete",
];

/**
 * Auth routes a signed-in visitor is bounced away from -- but only when the
 * account actually has a tenant (see `userHasTenant`).
 *
 * `/signup` is deliberately absent. A Supabase account can be signed in without
 * a matching `User`/`Business` row, and `login` (lib/auth-actions.ts) sends
 * exactly those accounts to /signup to create their business.
 *
 * `/login` is blocked for accounts that *do* have a tenant, so a signed-in owner
 * lands on the dashboard. An account with no tenant must keep /login reachable:
 * bouncing it to `/` would loop forever (the dashboard throws "no business",
 * the login action redirects back to /signup, and /signup cannot sign out or
 * switch accounts), so those accounts are allowed on both /login and /signup.
 */
const SIGNED_IN_BLOCKED_PATHS = ["/login"];

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Whether the signed-in Supabase user already has a tenant (`User` row).
 *
 * Mirrors the matching in `lib/auth.ts` `loadTenant`: link on `supabaseUserId`,
 * falling back to an unclaimed row with the same email (the row `loadTenant`
 * would adopt). Only called for /login, so the proxy stays cheap on every other
 * request. If the lookup fails we report `false` (allow /login through): a
 * database blip must not lock an owner out of the only page that can sign them
 * out.
 */
async function userHasTenant(authUser: {
  id: string;
  email?: string | null;
}): Promise<boolean> {
  try {
    const byId = await prisma.user.findFirst({
      where: { supabaseUserId: authUser.id },
      select: { id: true },
    });
    if (byId) return true;

    if (!authUser.email) return false;

    const unclaimed = await prisma.user.findFirst({
      where: { email: authUser.email, supabaseUserId: null },
      select: { id: true },
    });
    return unclaimed !== null;
  } catch (error) {
    console.error("[proxy] could not check for a tenant row:", error);
    return false;
  }
}

/**
 * Runs before every matched request (see the root `proxy.ts`).
 *
 * Two jobs:
 *  1. Refresh the Supabase session and write the rotated cookies back onto the
 *     response, so a server-rendered session stays alive. This must happen
 *     before the response is created, otherwise the refresh is lost.
 *  2. Do a cheap, optimistic redirect: signed-out visitors never reach a
 *     dashboard page, and signed-in users *with a tenant* are sent away from
 *     /login. Signed-in accounts without a tenant can reach both /login and
 *     /signup, so they can sign out or switch accounts instead of looping.
 *
 * This is deliberately *not* the authorization layer. `requireAuth()` and
 * `getCurrentBusinessId()` re-check the session where the data is actually
 * read, which is what protects the API routes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  let supabase;
  try {
    const { url, key } = getSupabaseEnv();

    supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Rebuild the response so the refreshed cookies travel with it.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
  } catch (error) {
    // Without Supabase credentials every request would 500, which makes an
    // unconfigured app impossible to look at. Let the request through instead;
    // the pages that need auth report the configuration error themselves.
    if (isMissingConfigError(error)) {
      console.error(`[proxy] ${error.message}`);
      return response;
    }
    throw error;
  }

  // getUser() validates the token against Supabase Auth and returns null when
  // there is no valid session, so it doubles as the signed-in check.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");

  // Leave API routes alone: they answer with 401 JSON rather than an HTML
  // redirect, which is what fetch() callers can act on.
  if (!isApiRoute) {
    if (!user) {
      const isPublic = matchesPath(pathname, PUBLIC_PATHS);
      const isAgentPublic = matchesPath(pathname, AGENT_PUBLIC_PATHS);
      const isAgentArea =
        pathname === "/agents" || pathname.startsWith("/agents/");

      if (!isPublic && !isAgentPublic && !matchesPath(pathname, AUTH_PATHS)) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = isAgentArea ? "/agents/login" : "/login";
        loginUrl.search = "";
        return NextResponse.redirect(loginUrl);
      }
    }

    if (
      user &&
      matchesPath(pathname, SIGNED_IN_BLOCKED_PATHS) &&
      (await userHasTenant(user))
    ) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return response;
}
