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
 * `activeSectionId()` builds on the same rule to answer which collapsible
 * group a page belongs to — the dashboard rail's exclusive accordion.
 */

/** Hrefs that only match themselves, never their children. */
const EXACT_ONLY_HREFS: ReadonlySet<string> = new Set(["/settings"]);

export function isActiveNavPath(pathname: string, href: string): boolean {
  if (EXACT_ONLY_HREFS.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The minimum a collapsible navigation group must expose to be grouped. */
export type NavSectionLike = {
  id: string;
  items: ReadonlyArray<{ href: string }>;
};

/**
 * The id of the first group that owns `pathname`, or `null` when the visitor
 * is on a page no group lists (a billing screen, a detail page nobody links).
 *
 * The dashboard sidebar's accordion seeds itself with this, so the group the
 * visitor is actually inside is the one that starts expanded and every other
 * group starts folded. Groups arrive pre-filtered by the caller, because a
 * staff member must never have the rail unfold onto an owner-only row.
 */
export function activeSectionId(
  pathname: string,
  sections: ReadonlyArray<NavSectionLike>,
): string | null {
  // Root path "/" defaults to the "manage" section for the dashboard accordion.
  if (pathname === "/") {
    return "manage";
  }
  for (const section of sections) {
    if (section.items.some((item) => isActiveNavPath(pathname, item.href))) {
      return section.id;
    }
  }
  return null;
}
