import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The installable-app surface: `public/manifest.json`, the root layout's
 * manifest/theme metadata, the dashboard's install button and the service
 * worker behind it.
 *
 * These are pinned because every one of them fails silently in production:
 *
 * 1. A manifest without `display: standalone`, a 192px and a 512px icon or a
 *    `start_url` is simply not installable, and Chrome shows no error — the
 *    "Install app" entry just never appears.
 * 2. Chromium only fires `beforeinstallprompt` when the page has a service
 *    worker, so dropping `/sw.js` (or its registration) disables the button
 *    while the manifest still validates.
 * 3. `theme_color` must stay the brand orange, and the browser chrome colour
 *    (`viewport.themeColor`) must agree with it, or an installed app opens with
 *    a white bar above an orange splash.
 */

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

type Manifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  lang: string;
  start_url: string;
  scope: string;
  display: string;
  display_override: string[];
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
  shortcuts: { name: string; short_name: string; url: string }[];
  prefer_related_applications: boolean;
};

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const manifest = JSON.parse(read("public/manifest.json")) as Manifest;

/** PNG IHDR width/height, so a declared size cannot drift from the file. */
function pngSize(src: string): { width: number; height: number } {
  const buffer = readFileSync(new URL(`../public${src}`, import.meta.url));
  assert.equal(
    buffer.subarray(1, 4).toString("ascii"),
    "PNG",
    `${src} must be a real PNG`,
  );
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("the manifest is installable and branded", () => {
  assert.equal(manifest.id, "/", "the app id must be stable across installs");
  assert.ok(manifest.name.length > 0);
  assert.ok(
    manifest.short_name.length > 0 && manifest.short_name.length <= 12,
    "the home-screen label is truncated past ~12 characters",
  );
  assert.ok(manifest.description.length > 40);
  assert.equal(manifest.lang, "en-NG");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.display_override.includes("standalone"));
  assert.equal(manifest.start_url, "/dashboard");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.background_color, "#ffffff");
  assert.equal(manifest.theme_color, "#ff6600");
  assert.equal(manifest.prefer_related_applications, false);
});

test("the theme colour is the one the design tokens use", () => {
  assert.match(read("app/globals.css"), /--color-colly:\s*#ff6600/i);
});

test("the manifest ships the icons Chrome installs", () => {
  const pngs = manifest.icons.filter((icon) => icon.type === "image/png");
  const sizes = pngs.map((icon) => icon.sizes);

  assert.ok(sizes.includes("192x192"), "Chrome requires a 192px icon");
  assert.ok(sizes.includes("512x512"), "Chrome requires a 512px icon");
  assert.ok(
    pngs.some((icon) => icon.purpose === "maskable"),
    "Android masks the icon, so a maskable variant must exist",
  );

  for (const icon of pngs) {
    const [width, height] = icon.sizes.split("x").map(Number);
    const actual = pngSize(icon.src);
    assert.equal(actual.width, width, `${icon.src} width must match ${icon.sizes}`);
    assert.equal(
      actual.height,
      height,
      `${icon.src} height must match ${icon.sizes}`,
    );
  }

  const vector = manifest.icons.find((icon) => icon.type === "image/svg+xml");
  assert.ok(vector, "the logo SVG is the resolution-independent fallback");
  assert.equal(vector.sizes, "any");
});

test("the shortcuts open real dashboard routes", () => {
  assert.ok(manifest.shortcuts.length > 0);
  for (const shortcut of manifest.shortcuts) {
    assert.ok(shortcut.url.startsWith("/"), `${shortcut.url} must be in-app`);
    assert.ok(shortcut.name.length > 0);
    assert.ok(shortcut.short_name.length > 0);
  }
});

test("the root layout links the manifest and themes the browser chrome", () => {
  const layout = read("app/layout.tsx");

  // `metadata.manifest` is what renders <link rel="manifest" href="/manifest.json" />.
  assert.match(layout, /manifest: "\/manifest\.json"/);
  assert.match(layout, /appleWebApp: \{/);
  assert.match(layout, /capable: true/);
  // Next emits the standard `mobile-web-app-capable`; older iOS Safari only
  // honours the Apple-prefixed tag, so the layout adds it explicitly.
  assert.match(layout, /name="apple-mobile-web-app-capable"/);

  // Next 14 moved themeColor into the viewport export; leaving it in metadata
  // emits a deprecation warning and no meta tag.
  assert.match(layout, /export const viewport: Viewport = \{/);
  assert.match(layout, /themeColor: "#ff6600"/);

  // The dashboard tokens flip under `prefers-color-scheme: dark`, so the native
  // controls and the installed app's chrome must be allowed to flip with them.
  assert.match(
    layout,
    /colorScheme: "light dark"/,
    "a light-only colorScheme contradicts the dark tokens in globals.css",
  );
});

test("the dashboard header offers the install button", () => {
  const shell = read("components/dashboard/dashboard-shell.tsx");
  assert.match(
    shell,
    /import \{ InstallPrompt \} from "@\/components\/pwa\/install-prompt"/,
  );
  assert.match(shell, /<InstallPrompt \/>/);
});

test("the install prompt uses the browser's install event", () => {
  const component = read("components/pwa/install-prompt.tsx");

  assert.match(component, /^"use client";/);
  assert.match(component, /beforeinstallprompt/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /appinstalled/);
  assert.match(component, /promptEvent\.prompt\(\)/);
  assert.match(component, /userChoice/);
  assert.match(component, /display-mode: standalone/);
  // Chromium will not fire the event without a service worker.
  assert.match(component, /serviceWorker\.register\("\/sw\.js"\)/);
});

test("the service worker never caches a page", () => {
  const worker = read("public/sw.js");

  assert.match(worker, /addEventListener\("fetch"/);
  assert.doesNotMatch(
    worker,
    /caches\.open|cache\.put|CacheStorage/,
    "a cached shell would outlive a deploy",
  );
});

test("the proxy lets the PWA files through signed out", () => {
  const proxy = read("proxy.ts");

  // The matcher regex is written with escaped dots, so match the source text.
  assert.ok(
    proxy.includes("sw\\\\.js"),
    "a redirect to /login would break the service worker registration",
  );
  assert.ok(
    proxy.includes("manifest.json") && proxy.includes(".*\\\\.json"),
    "the manifest must not require a session",
  );
});
