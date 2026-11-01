import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatNaira } from "../lib/format";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Directories that ship copy — everything a visitor or owner can read. */
const CODE_DIRS = ["app", "components", "lib", "prisma", "scripts", "tests"];
const CODE_FILE = /\.(tsx?|cjs|mjs|css)$/;

/** Every source file under a directory, as repo-relative paths. */
function codeFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) codeFiles(path, found);
    else if (CODE_FILE.test(entry.name)) found.push(path);
  }
  return found;
}

/**
 * What a UTF-8 file looks like after something decoded it as Windows-1252 and
 * saved it again: the Naira sign (bytes E2 82 A6) becomes U+00E2 U+201A U+00A6
 * and an em dash (E2 80 94) becomes U+00E2 U+20AC U+201D. U+FFFD means the
 * bytes were already lost, so the text cannot be recovered at all.
 */
const MOJIBAKE = [
  /\u00E2\u20AC/, // em dash, curly quotes, ellipsis
  /\u00E2\u201A/, // the Naira sign — the Free plan card shipped as this
  /\u00C3[\u00A0-\u00BF]/, // a UTF-8 letter read as two (U+00C3 then a Latin-1 byte)
  /\uFFFD/,
];

test("no source file carries cp1252 mojibake", () => {
  const offenders = CODE_DIRS.flatMap((dir) => codeFiles(dir)).filter((path) =>
    MOJIBAKE.some((pattern) => pattern.test(source(path))),
  );

  assert.deepEqual(offenders, []);
});

test("formatNaira prints a real Naira sign", () => {
  // The exact regression: the marketing Free card rendered garbage before "0".
  assert.equal(formatNaira(0), "\u20A60");
  assert.equal(formatNaira(15_000), "\u20A615,000");
  assert.equal(formatNaira(1_500_000), "\u20A61,500,000");

  // Kobo only when the amount actually has them.
  assert.equal(formatNaira(1500.5), "\u20A61,500.50");
  assert.equal(formatNaira(1500), "\u20A61,500");

  // A value that is not a finite number is priced at zero, never "\u20A6NaN".
  assert.equal(formatNaira(Number.NaN), "\u20A60");
  assert.equal(formatNaira(Number.POSITIVE_INFINITY), "\u20A60");
});

test("the Naira sign is one escaped constant, not a literal character", () => {
  const format = source("lib/format.ts");

  // `"\u20A6"` survives a cp1252 save; the character itself does not.
  assert.match(format, /const NAIRA_SIGN = "\\u20A6";/);
  assert.match(format, /return `\$\{NAIRA_SIGN\}/);

  // Outside the prose explaining the escape, no code builds the sign by hand.
  const code = format.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(
    code.includes("\u20A6"),
    false,
    "formatNaira must use NAIRA_SIGN, not its own literal",
  );
});

test("the marketing plan cards take every price from formatNaira", () => {
  const pricing = source("components/marketing/pricing.tsx");

  // Free used to be the hardcoded string that got corrupted on the way in.
  assert.match(pricing, /price: formatNaira\(0\)/);
  assert.match(pricing, /price: formatNaira\(PLANS\.green\.monthly\)/);
  assert.match(pricing, /price: formatNaira\(PLANS\.blue\.monthly\)/);
  assert.match(pricing, /price: formatNaira\(PLANS\.black\.monthly\)/);

  // A quoted price is a price that can drift from lib/plans.ts — or rot.
  assert.equal(/price:\s*"/.test(pricing), false);
});
