/**
 * Active-route matching for the navigation chrome (dashboard sidebar, the
 * mobile tab bar and the agent sidebar).
 *
 * A row stays highlighted on its own nested pages — `/conversations/abc`
 * lights up `/conversations` — because a parent is what the visitor clicked.
 * `/settings` is the deliberate exception: its sub-pages (`/settings/billing`,
 * `/settings/team`, …) each have their own row, so a prefix match there would
 * highlight two items at once.
 *
 * One helper for all three surfaces, so the desktop rail, the phone tab bar
 * and the agent menu can never disagree about where the visitor is.
 */

/** Hrefs that only match themselves, never their children. */
const EXACT_ONLY_HREFS: ReadonlySet<string> = new Set(["/settings"]);

export function isActiveNavPath(pathname: string, href: string): boolean {
  if (EXACT_ONLY_HREFS.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
