import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { isActiveNavPath } from "../lib/nav";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

test("isActiveNavPath matches a row, its children and nothing else", () => {
  assert.equal(isActiveNavPath("/dashboard", "/dashboard"), true);
  assert.equal(isActiveNavPath("/conversations/abc", "/conversations"), true);
  assert.equal(isActiveNavPath("/agents/training/react-basics", "/agents/training"), true);

  assert.equal(isActiveNavPath("/conversations", "/dashboard"), false);
  assert.equal(isActiveNavPath("/", "/dashboard"), false);

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

  assert.equal(isActiveNavPath("/settings/team", "/settings/team"), true);
  assert.equal(isActiveNavPath("/settings/team/abc", "/settings/team"), true);
});

test("the rail, the tab bar and the eyebrow say Dashboard and Business", () => {
  const sidebar = source("components/dashboard/sidebar.tsx");
  const mobile = source("components/dashboard/mobile-nav.tsx");
  const page = source("app/(dashboard)/dashboard/page.tsx");

  assert.match(sidebar, /\{ label: "Dashboard", href: "\/dashboard"/);
  assert.match(sidebar, /\{ label: "Business", href: "\/business"/);
  assert.doesNotMatch(sidebar, /label: "Overview"/);
  assert.doesNotMatch(sidebar, /label: "Sell"/);

  assert.match(mobile, /label: "Dashboard"/);
  assert.doesNotMatch(mobile, /label: "Sell"/);

  assert.match(page, />\s*Dashboard\s*</);
  assert.doesNotMatch(page, />\s*Overview\s*</);
});

test("sidebar renders a flat permanent link list without collapsible accordions", () => {
  const text = source("components/dashboard/sidebar.tsx");

  assert.match(text, /const NAV_ITEMS: NavItem\[\] = \[/);
  assert.doesNotMatch(text, /grid-rows-\[0fr\]/);
  assert.doesNotMatch(text, /grid-rows-\[1fr\]/);
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

  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /document\.body\.style\.overflow = "hidden"/);
  assert.match(shell, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(shell, /drawerRef\.current\?\.focus\(\)/);
  assert.match(shell, /trigger\?\.focus\(\)/);

  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /event\.shiftKey && active === first/);

  assert.match(
    shell,
    /drawerRef\.current\.querySelectorAll<HTMLElement>\(\s*"a\[href\], button:not\(\[disabled\]\)",?\s*\)/,
  );
});
