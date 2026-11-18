import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Stylesheet text without its comments, so prose about a rule is not a rule. */
function css(path: string): string {
  return source(path).replace(/\/\*[\s\S]*?\*\//g, "");
}

const CODE_FILE = /\.tsx?$/;

/** Every component/provider file under a directory, as repo-relative paths. */
function codeFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) codeFiles(path, found);
    else if (CODE_FILE.test(entry.name)) found.push(path);
  }
  return found;
}

/** Libraries that take over wheel/touch scrolling and re-implement momentum. */
const SMOOTH_SCROLL_PACKAGES = [
  "@studio-freight/lenis",
  "@studio-freight/react-lenis",
  "lenis",
  "locomotive-scroll",
  "react-locomotive-scroll",
];

test("the page keeps the browser's own scroll physics", () => {
  const sheet = css("app/globals.css");

  // No page-wide smoothing: it fights trackpad precision and anchor jumps.
  assert.equal(/scroll-behavior\s*:\s*smooth/.test(sheet), false);

  // The contract is stated where Tailwind's preflight cannot override it.
  const bodyRule = /html,\s*body\s*\{([^}]*)\}/.exec(sheet);
  assert.ok(bodyRule, "app/globals.css lost its `html, body` rule");
  assert.match(bodyRule[1], /scroll-behavior:\s*auto/);

  // Pinch-zoom is part of the same contract. The document names the whole
  // native gesture set — both pan axes plus `pinch-zoom` — instead of leaving
  // it to a shorthand that silently drops the two-finger gesture.
  assert.match(
    bodyRule[1],
    /touch-action:\s*pan-x\s+pan-y\s+pinch-zoom/,
    "the document must keep native pinch-zoom",
  );
  assert.doesNotMatch(sheet, /touch-action:\s*none/);
  assert.doesNotMatch(
    sheet,
    /touch-action:\s*pan-y\s*;/,
    "a bare `pan-y` switches pinch-zoom off",
  );

  // Horizontal overflow is clipped, never scrolled: `overflow-x: hidden`
  // makes the box a scroll container (its `overflow-y` computes to `auto`).
  assert.match(bodyRule[1], /overflow-x:\s*clip/);
});

test("two-finger pinch-zoom stays optical, not a layout reflow", () => {
  const layout = source("app/layout.tsx");
  const viewport = /export const viewport: Viewport = \{([\s\S]*?)\};/.exec(layout);
  assert.ok(viewport, "app/layout.tsx lost its viewport export");

  // Stated, not inherited: the mobile viewport is explicit and scalable.
  assert.match(viewport[1], /width:\s*"device-width"/);
  assert.match(viewport[1], /initialScale:\s*1/);
  assert.match(viewport[1], /userScalable:\s*true/);

  // No cap. `maximumScale` (and `maximumScale: 1` above all) turns a pinch
  // into a no-op or a layout reflow instead of a visual zoom.
  assert.equal(
    /maximumScale/.test(viewport[1]),
    false,
    "a maximum scale locks two-finger zoom",
  );

  // The shell clips with `clip`, never `hidden`: `hidden` makes each wrapper a
  // scroll container, which is the "pinch inflates the page" symptom.
  const shell = source("components/dashboard/dashboard-shell.tsx");
  assert.doesNotMatch(shell, /className="[^"]*overflow-x-hidden/);
  assert.match(shell, /className="[^"]*overflow-x-clip/);

  // The inbox swipe row used to set a bare `touch-pan-y`, switching pinch-zoom
  // off across a list that fills the phone screen.
  const inbox = source("app/(dashboard)/conversations/page.tsx");
  assert.doesNotMatch(inbox, /className="[^"]*touch-pan-y(?!-)/);
  assert.match(inbox, /touch-pan-y-pinch-zoom/);

  // …and that class is the full gesture set, not a rename of `pan-y`.
  assert.match(
    css("app/globals.css"),
    /\.touch-pan-y-pinch-zoom\s*\{\s*touch-action:\s*pan-y\s+pinch-zoom\s*;/,
  );
});

test("no scroll-hijacking library is installed or mounted", () => {
  const pkg = JSON.parse(source("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const installed = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const name of SMOOTH_SCROLL_PACKAGES) {
    assert.equal(name in installed, false, `${name} must not be a dependency`);
  }

  // The wrapper component is gone too — an unused copy invites a re-mount.
  assert.equal(existsSync(join(ROOT, "components/ui/smooth-scroll.tsx")), false);

  const layout = source("app/(marketing)/layout.tsx");
  assert.equal(/from\s+["'][^"']*smooth-scroll["']/.test(layout), false);
  assert.equal(/<SmoothScroll/.test(layout), false);
});

test("the only scripted scroll is the inbox thread following a message", () => {
  const callers = ["app", "components"]
    .flatMap((dir) => codeFiles(dir))
    .filter((path) => /\bscrollIntoView\(|\bscrollTo\(/.test(source(path)));

  assert.deepEqual(callers, ["app/(dashboard)/conversations/[id]/page.tsx"]);

  const thread = source(callers[0]);
  assert.match(thread, /block:\s*"end"/);
  // Jump on first paint, glide for later messages: a smooth jump on mount is
  // the "page scrolls itself on load" complaint, and it breaks deep links.
  assert.match(
    thread,
    /behavior:\s*lastMessageCount\.current === 0 \? "auto" : "smooth"/,
  );
});
