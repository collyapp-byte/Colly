import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** globals.css without its comments, so prose about a token is not a token. */
function css(): string {
  return source("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
}

const SURFACE_TOKENS = [
  "--background",
  "--card-surface",
  "--card-border",
  "--text-main",
] as const;

/** The declared value of a custom property inside one CSS block. */
function valueIn(block: string, token: string): string | null {
  const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(block);
  return match ? match[1].trim() : null;
}

test("light and dark values exist for every dashboard surface token", () => {
  const sheet = css();

  const lightBlock = /:root\s*\{([\s\S]*?)\}/.exec(sheet);
  assert.ok(lightBlock, "app/globals.css lost its :root block");

  const darkBlock =
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}\s*\}/.exec(
      sheet,
    );
  assert.ok(
    darkBlock,
    "the dashboard tokens must be re-declared inside `prefers-color-scheme: dark`",
  );

  for (const token of SURFACE_TOKENS) {
    const light = valueIn(lightBlock[1], token);
    const dark = valueIn(darkBlock[1], token);

    assert.ok(light, `${token} has no light value`);
    assert.ok(dark, `${token} has no dark value`);
    assert.notEqual(
      light,
      dark,
      `${token} must actually change between light and dark`,
    );
  }
});

test("Tailwind utilities stay wired to the runtime tokens", () => {
  const sheet = css();
  const inline = /@theme\s+inline\s*\{([\s\S]*?)\n\}/.exec(sheet);
  assert.ok(inline, "the `@theme inline` block is what keeps utilities live");

  const aliases: Array<[string, string]> = [
    ["--color-background", "--background"],
    ["--color-card-surface", "--card-surface"],
    ["--color-card-border", "--card-border"],
    ["--color-main", "--text-main"],
    ["--color-muted", "--text-muted"],
    ["--color-surface-muted", "--surface-muted"],
    ["--color-input", "--input-surface"],
  ];

  for (const [utility, token] of aliases) {
    assert.match(
      inline[1],
      new RegExp(`${utility}\\s*:\\s*var\\(${token}\\)`),
      `${utility} must resolve to var(${token})`,
    );
  }
});

test("dashboard form controls are themed inside the shell only", () => {
  const sheet = css();
  const fieldRule = /@layer\s+base\s*\{([\s\S]*?)\n\}/.exec(sheet);
  assert.ok(fieldRule, "app/globals.css lost its dashboard base layer");

  const rule = fieldRule[1];
  assert.match(
    rule,
    /\[data-dashboard-shell\][\s\S]*?background-color:\s*var\(--input-surface\)/,
    "fields need the input surface token, not a transparent background",
  );
  assert.match(
    rule,
    /\[data-dashboard-shell\][\s\S]*?color:\s*var\(--text-main\)/,
    "field text must follow the main text token",
  );
  assert.match(
    rule,
    /\[data-dashboard-shell\][\s\S]*?::placeholder[\s\S]*?color:\s*var\(--text-muted\)/,
    "placeholders must follow the muted text token",
  );

  // The rule must stay scoped, otherwise it repaints the fixed light auth and
  // marketing forms in dark mode.
  assert.match(
    rule.trimStart(),
    /^\[data-dashboard-shell\]/,
    "the field rules must be scoped to the dashboard shell",
  );
});

test("dashboard chrome and cards no longer hardcode the light palette", () => {
  const themed = [
    "components/dashboard/dashboard-shell.tsx",
    "components/dashboard/sidebar.tsx",
    "components/dashboard/mobile-nav.tsx",
    "components/ui/card.tsx",
    "components/ui/stat-card.tsx",
    "components/ui/modal.tsx",
    "components/ui/empty-state.tsx",
    "components/ui/skeleton.tsx",
  ];

  const lightOnly = [
    /\bbg-white\b/,
    /\btext-gray-[3-9]00\b/,
    /\bbg-gray-[1-2]00\b/,
    /\bborder-gray-[1-3]00\b/,
    /\bdivide-gray-100\b/,
  ];

  for (const path of themed) {
    const text = source(path);
    for (const pattern of lightOnly) {
      assert.equal(
        pattern.test(text),
        false,
        `${path} still hardcodes ${pattern} instead of a token`,
      );
    }
  }

  const shell = source("components/dashboard/dashboard-shell.tsx");
  assert.match(
    shell,
    /data-dashboard-shell[\s\S]{0,400}bg-background/,
    "the shell's outer surface must use the background token",
  );
});

test("the card surface system keeps a light and dark elevation ladder", () => {
  const sheet = css();

  const lightBlock = /:root\s*\{([\s\S]*?)\}/.exec(sheet);
  assert.ok(lightBlock, "app/globals.css lost its :root block");

  const darkBlock =
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}\s*\}/.exec(
      sheet,
    );
  assert.ok(
    darkBlock,
    "the elevation ladder must be re-declared inside `prefers-color-scheme: dark`",
  );

  // The depth is a ladder, not one hard drop shadow: rest, hover and pressed.
  const elevationTokens = [
    "--card-shadow",
    "--card-shadow-hover",
    "--card-shadow-active",
    "--card-ring",
    "--card-highlight",
  ] as const;

  for (const token of elevationTokens) {
    assert.ok(
      valueIn(lightBlock[1], token),
      `${token} has no light value`,
    );
    assert.ok(valueIn(darkBlock[1], token), `${token} has no dark value`);
  }

  // The three surfaces the dashboard and settings pages are built from.
  assert.match(
    sheet,
    /@layer\s+components\s*\{[\s\S]*?\.surface-card\s*\{[\s\S]*?var\(--card-shadow\)/,
    "`.surface-card` must build its depth from the runtime shadow ladder",
  );
  assert.match(
    sheet,
    /\.surface-card-interactive:hover\s*\{[\s\S]*?translateY\(-2px\)/,
    "an interactive card must lift under the pointer",
  );
  assert.match(
    sheet,
    /\.surface-card-interactive:active\s*\{[\s\S]*?scale\(0\.985\)/,
    "an interactive card must press back down",
  );
  assert.match(
    sheet,
    /\.surface-panel\s*\{/,
    "nested panels need their own quieter surface",
  );

  // 250ms is the interaction clock for the whole shell: `.surface-card` owns the
  // card timing, and the interactive primitives declare it themselves.
  assert.match(
    sheet,
    /\.surface-card\s*\{[\s\S]*?transition:[\s\S]*?250ms/,
    "`.surface-card` must ease its elevation at 250ms",
  );

  assert.match(
    source("components/ui/card.tsx"),
    /surface-card/,
    "Card must be built from the shared surface class",
  );

  for (const path of [
    "components/ui/stat-card.tsx",
    "components/ui/button.tsx",
    "components/dashboard/sidebar.tsx",
  ]) {
    assert.match(source(path), /duration-250/, `${path} lost its 250ms motion`);
  }

  assert.match(
    source("components/ui/button.tsx"),
    /active:scale-\[0\.98\]/,
    "buttons must keep the press-scale micro-interaction",
  );
});

test("the printed QR card deliberately keeps its white surface", () => {
  const page = source("app/(dashboard)/settings/qr-code/page.tsx");
  const card = /data-print-card[\s\S]*?data-print-hide/.exec(page);
  assert.ok(card, "the QR card block is missing");

  assert.match(card[0], /bg-white/, "the QR card prints on white paper");
  assert.match(
    card[0],
    /text-gray-900/,
    "the QR card's text must not follow the dark scheme",
  );
});
