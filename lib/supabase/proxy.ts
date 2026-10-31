import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import {
  isPublicRoute,
  isUnknownGeoRoute,
  NOT_FOUND_REWRITE_PATH,
} from "@/lib/public-routes";
import { isOwnerOnlyPath, STAFF_DENIED_REDIRECT, type TeamRole } from "@/lib/team";

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
 * The role the signed-in Supabase user has inside a business, or null when the
 * account has no tenant at all.
 *
 * Mirrors the matching in `lib/auth.ts` `loadTenant`: the owner's `User` row is
 * looked up on `supabaseUserId`, falling back to an unclaimed row with the same
 * email (the row `loadTenant` would adopt). Only when neither matches is the
 * address looked up in `TeamMember`, which is what makes an invited account
 * STAFF. Called only for /login and the owner-only settings paths, so the proxy
 * stays cheap on every other request.
 *
 * A failed lookup reports `null` (no tenant): a database blip must not lock an
 * owner out of the only page that can sign them out, and the owner-only pages
 * re-check the session in `requireAuth()` / `requireOwner()` anyway.
 */
async function resolveTenantRole(authUser: {
  id: string;
  email?: string | null;
}): Promise<TeamRole | null> {
  try {
    const byId = await prisma.user.findFirst({
      where: { supabaseUserId: authUser.id },
      select: { id: true },
    });
    if (byId) return "OWNER";

    if (!authUser.email) return null;

    const unclaimed = await prisma.user.findFirst({
      where: { email: authUser.email, supabaseUserId: null },
      select: { id: true },
    });
    if (unclaimed) return "OWNER";

    const staff = await prisma.teamMember.findFirst({
      where: { email: { equals: authUser.email, mode: "insensitive" } },
      select: { id: true },
    });

    return staff ? "STAFF" : null;
  } catch (error) {
    console.error("[proxy] could not resolve the tenant role:", error);
    return null;
  }
}

/**
 * Runs before every matched request (see the root `proxy.ts`).
 *
 * Four jobs:
 *  1. Answer `/locations/<unknown>`, `/countries/<unknown>` and `/vs/<unknown>`
 *     with a real 404 (see `isUnknownGeoRoute`) before any rendering starts.
 *  2. Refresh the Supabase session and write the rotated cookies back onto the
 *     response, so a server-rendered session stays alive. This must happen
 *     before the response is created, otherwise the refresh is lost.
 *  3. Do a cheap, optimistic redirect: signed-out visitors never reach a
 *     dashboard page, and signed-in users *with a tenant* are sent away from
 *     /login. Signed-in accounts without a tenant can reach both /login and
 *     /signup, so they can sign out or switch accounts instead of looping.
 *  4. Keep invited STAFF out of the owner-only settings areas
 *     (`OWNER_ONLY_PATHS`: billing, AI line, team) by bouncing them to
 *     `/dashboard?denied=staff_restricted`, which the dashboard turns into a
 *     toast.
 *
 * This is deliberately *not* the authorization layer. `requireAuth()` and
 * `getCurrentBusinessId()` re-check the session where the data is actually
 * read, which is what protects the API routes — and because `/api` is skipped
 * here, the owner-only mutation routes check `requireOwnerApi()` themselves.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // Programmatic GEO pages (`/locations/<city>`, `/vs/<competitor>`) only exist
  // for the records in their data modules. An unknown slug has to answer with a
  // real 404 *before* the partially prerendered shell streams, otherwise
  // `notFound()` inside the page can only leave the 200 status in place (see
  // `isUnknownGeoRoute`). This runs first: it needs no session and no database.
  if (isUnknownGeoRoute(pathname)) {
    const notFoundUrl = request.nextUrl.clone();
    notFoundUrl.pathname = NOT_FOUND_REWRITE_PATH;
    notFoundUrl.search = "";
    return NextResponse.rewrite(notFoundUrl);
  }

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

  const isApiRoute = pathname.startsWith("/api");

  // Leave API routes alone: they answer with 401 JSON rather than an HTML
  // redirect, which is what fetch() callers can act on.
  if (!isApiRoute) {
    if (!user) {
      const isPublic = isPublicRoute(pathname);
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
      (await resolveTenantRole(user)) !== null
    ) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }

    // Team Collaboration: an invited STAFF account may use the dashboard, but
    // not the owner's money or channel settings. The flag in the redirect target
    // is the closest a proxy can get to a toast — the overview page raises it.
    if (
      user &&
      isOwnerOnlyPath(pathname) &&
      (await resolveTenantRole(user)) === "STAFF"
    ) {
      const deniedUrl = new URL(STAFF_DENIED_REDIRECT, request.nextUrl.origin);
      return NextResponse.redirect(deniedUrl);
    }
  }

  return response;
}
