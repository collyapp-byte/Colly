/**
 * Team Collaboration: roles, owner-only settings areas and the staff bounce.
 *
 * A tenant has exactly one OWNER — the `User` row that signed up — plus any
 * number of invited STAFF. Staff are stored as `TeamMember` rows and matched to
 * a Supabase session by email (`lib/auth.ts#loadTenant`), so they reach the same
 * dashboard as the owner but with the areas below closed to them.
 *
 * This module is deliberately dependency-free: `lib/supabase/proxy.ts` runs on
 * every request (it must not pull Prisma or Supabase into a graph a test can
 * reach) and `tests/team.test.ts` imports it directly.
 */

/** The role a signed-in account has inside its business. */
export const TEAM_ROLES = ["OWNER", "STAFF"] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

/**
 * Narrows an untrusted value (a request body, a stored column) to a role.
 */
export function isTeamRole(value: unknown): value is TeamRole {
  return (
    typeof value === "string" && (TEAM_ROLES as readonly string[]).includes(value)
  );
}

/** Longest name an invite may carry (`TeamMember.name` is required). */
export const TEAM_MEMBER_NAME_MAX = 80;

/**
 * One staff row as the settings UI renders it.
 *
 * `createdAt` is an ISO string, not a `Date`: the team page is a Server
 * Component that hands this straight to a Client Component, and a string keeps
 * the payload obvious (and the formatting in one place).
 */
export type TeamMemberView = {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  createdAt: string;
};

/**
 * The owner row shown above the staff list. Built from the session
 * (`AuthUser`), never from a `TeamMember` row — the owner is a `User` row.
 */
export type TeamOwnerView = {
  email: string;
  /** `User.name` is nullable; the manager falls back to a neutral label. */
  name: string | null;
};

/**
 * Settings areas only the business owner may open.
 *
 * The proxy redirects a STAFF session away from every one of these (it must
 * also match sub-paths, e.g. `/settings/billing/callback`), and the mutation
 * APIs behind them answer 403 for staff — the proxy leaves `/api` routes alone,
 * so the route-level guard is what actually protects them.
 */
export const OWNER_ONLY_PATHS: readonly string[] = [
  "/settings/billing",
  "/settings/ai-line",
  "/settings/team",
];

/** True when `pathname` is an owner-only area or lives beneath one. */
export function isOwnerOnlyPath(pathname: string): boolean {
  return OWNER_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Query flag the proxy adds when it bounces a staff member. */
export const STAFF_DENIED_PARAM = "denied";

/** Value of `?denied=` that the dashboard turns into an "owner only" toast. */
export const STAFF_DENIED_VALUE = "staff_restricted";

/** Shown to a staff member who tries to open an owner-only area. */
export const STAFF_DENIED_MESSAGE =
  "Only the business owner can open that page.";

/**
 * Where a bounced staff member lands: `/dashboard?denied=staff_restricted`.
 * The dashboard reads the flag and raises a toast, which is as close to an
 * alert as a redirect can get — the proxy never renders HTML itself.
 */
export const STAFF_DENIED_REDIRECT = `/dashboard?${STAFF_DENIED_PARAM}=${STAFF_DENIED_VALUE}`;
