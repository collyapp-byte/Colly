import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { activeSectionId, isActiveNavPath } from "../lib/nav";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

test("isActiveNavPath matches a row, its children and nothing else", () => {
  assert.equal(isActiveNavPath("/dashboard", "/dashboard"), true);
  assert.equal(isActiveNavPath("/conversations/abc", "/conversations"), true);
  assert.equal(isActiveNavPath("/agents/training/react-basics", "/agents/training"), true);

  assert.equal(isActiveNavPath("/conversations", "/dashboard"), false);
  assert.equal(isActiveNavPath("/", "/dashboard"), false);

  // A look-alike prefix is a different page, not a child of the row.
  assert.equal(isActiveNavPath("/dashboard-archive", "/dashboard"), false);
  assert.equal(isActiveNavPath("/settingsx", "/settings"), false);
});

test("/settings is exact-only, because its children own rows of their own", () => {
  assert.equal(isActiveNavPath("/settings", "/settings"), true);

  for (const child of [
    "/settings/billing",
    "/settings/team",
    "/settings/whatsapp",
    "/settings/qr-code",
  ]) {
    assert.equal(
      isActiveNavPath(child, "/settings"),
      false,
      `${child} must not highlight Settings as well`,
    );
  }

  // The children still highlight themselves.
  assert.equal(isActiveNavPath("/settings/team", "/settings/team"), true);
  assert.equal(isActiveNavPath("/settings/team/abc", "/settings/team"), true);
});

test("the rail, the tab bar and the eyebrow say Dashboard and Business", () => {
  const sidebar = source("components/dashboard/sidebar.tsx");
  const mobile = source("components/dashboard/mobile-nav.tsx");
  const page = source("app/(dashboard)/dashboard/page.tsx");

  // The home row names the page it opens, and Business is a top-level section.
  assert.match(sidebar, /\{ label: "Dashboard", href: "\/dashboard"/);
  assert.match(sidebar, /title: "Business"/);
  assert.doesNotMatch(sidebar, /label: "Overview"/);
  assert.doesNotMatch(sidebar, /title: "Sell"/);

  assert.match(mobile, /label: "Dashboard"/);
  assert.doesNotMatch(mobile, /label: "Sell"/);

  // The eyebrow above the greeting matches the rail row; `uppercase` renders
  // it as DASHBOARD.
  assert.match(page, />\s*Dashboard\s*</);
  assert.doesNotMatch(page, />\s*Overview\s*</);
});

test("activeSectionId names the group that owns the current page", () => {
  const sections = [
    { id: "home", items: [{ href: "/dashboard" }, { href: "/business" }] },
    { id: "inbox", items: [{ href: "/conversations" }] },
    { id: "sell", items: [{ href: "/sales" }, { href: "/invoices" }] },
    { id: "manage", items: [{ href: "/settings" }, { href: "/channels" }] },
    { id: "agents", items: [{ href: "/find-an-agent" }] },
  ];

  assert.equal(activeSectionId("/dashboard", sections), "home");
  assert.equal(activeSectionId("/business", sections), "home");
  assert.equal(activeSectionId("/invoices", sections), "sell");
  // A child page belongs to the group that lists its parent row.
  assert.equal(activeSectionId("/invoices/abc", sections), "sell");
  assert.equal(activeSectionId("/settings/team", sections), "manage");
  assert.equal(activeSectionId("/find-an-agent", sections), "agents");

  // `/settings` is exact-only, so its siblings stay in the group without
  // claiming the parent row.
  assert.equal(activeSectionId("/settings", sections), "manage");

  // A page no group lists expands nothing rather than guessing.
  assert.equal(activeSectionId("/settings/billing", sections), null);
  assert.equal(activeSectionId("/", sections), null);
});

test("the sidebar accordion is exclusive and starts on the active group", () => {
  const text = source("components/dashboard/sidebar.tsx");

  // Seeded from the route, and re-seeded when the route changes: landing on a
  // page always unfolds the group that owns it.
  assert.match(text, /activeSectionId\(pathname, sections\)/);
  assert.match(text, /key=\{pathname\}/);
  assert.match(
    text,
    /const open = !collapsible \|\| openSectionId === section\.id/,
    "every group except the open one must be folded",
  );

  // One open id, never a set: opening a group is what closes the previous one.
  assert.match(
    text,
    /const \[openSectionId, setOpenSectionId\] = useState<string \| null>/,
  );
  assert.match(text, /current === section\.id \? null : section\.id/);

  // Nothing is remembered across visits, so a reload cannot restore a stale
  // group while the current page's group stays folded.
  assert.doesNotMatch(text, /localStorage/);

  // The fold animates its height instead of jumping.
  assert.match(text, /grid-rows-\[0fr\]/);
  assert.match(text, /grid-rows-\[1fr\]/);
  assert.match(text, /transition-\[grid-template-rows,opacity\]/);
  assert.match(text, /duration-300/);
});

test("every navigation surface asks the same helper", () => {
  for (const path of [
    "components/dashboard/sidebar.tsx",
    "components/dashboard/mobile-nav.tsx",
    "components/agents/agent-sidebar.tsx",
  ]) {
    const text = source(path);
    assert.match(
      text,
      /from "@\/lib\/nav"/,
      `${path} must import the shared active-path helper`,
    );
    assert.doesNotMatch(
      text,
      /function isActive(?:Path)?\(/,
      `${path} must not keep a private copy of the active-path rule`,
    );
  }
});

const CHROME = [
  "components/dashboard/mobile-nav.tsx",
  "components/agents/agent-sidebar.tsx",
  "components/agents/agent-shell.tsx",
] as const;

test("navigation chrome is built from semantic tokens, not hardcoded colours", () => {
  for (const path of CHROME) {
    const text = source(path);
    assert.doesNotMatch(
      text,
      /#[0-9a-fA-F]{3,8}\b/,
      `${path} still hardcodes a hex colour instead of a token`,
    );
    assert.doesNotMatch(
      text,
      /\b(?:bg|text|border|divide|ring)-gray-\d{2,3}\b/,
      `${path} still hardcodes the light-only gray palette`,
    );
  }

  const mobile = source("components/dashboard/mobile-nav.tsx");
  for (const token of [
    "bg-colly-tint",
    "text-colly",
    "bg-card-surface",
    "border-card-border",
  ]) {
    assert.match(mobile, new RegExp(token), `mobile nav must use ${token}`);
  }

  for (const token of [
    "bg-colly-tint",
    "text-colly",
    "bg-card-surface",
    "border-card-border",
  ]) {
    assert.match(
      source("components/agents/agent-sidebar.tsx"),
      new RegExp(token),
      `the agent sidebar must use ${token}`,
    );
  }

  const shell = source("components/agents/agent-shell.tsx");
  assert.match(shell, /bg-card-surface/, "the agent shell must use bg-card-surface");
  assert.match(
    shell,
    /border-card-border/,
    "the agent shell must use border-card-border",
  );
  assert.doesNotMatch(
    shell,
    /bg-\(--background-page\)/,
    "the shell must use the themed background, not the static light page token",
  );
});

test("the chrome keeps the 250ms tactile interactions", () => {
  for (const path of CHROME) {
    const text = source(path);
    assert.match(text, /duration-250/, `${path} lost the 250ms motion clock`);
    assert.match(
      text,
      /active:scale-\[0\.98\]/,
      `${path} lost the press-scale micro-interaction`,
    );
  }
});

test("the agent drawer is a keyboard-accessible modal", () => {
  const shell = source("components/agents/agent-shell.tsx");

  assert.match(shell, /role="dialog"/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /id="agent-mobile-nav"/);
  assert.match(shell, /aria-controls="agent-mobile-nav"/);

  // Escape closes, the page behind stops scrolling, focus moves in and comes back.
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /document\.body\.style\.overflow = "hidden"/);
  assert.match(shell, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(shell, /drawerRef\.current\?\.focus\(\)/);
  assert.match(shell, /trigger\?\.focus\(\)/);

  // Tab is trapped inside the drawer.
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /event\.shiftKey && active === first/);

  // Focusable elements are discovered from the drawer, not the document.
  assert.match(
    shell,
    /drawerRef\.current\.querySelectorAll<HTMLElement>\(\s*"a\[href\], button:not\(\[disabled\]\)",?\s*\)/,
  );
});
