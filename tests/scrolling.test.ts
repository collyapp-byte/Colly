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

  // A blanket touch-action would also disable pinch-zoom for every visitor.
  assert.equal(/touch-action/.test(bodyRule[1]), false);
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
