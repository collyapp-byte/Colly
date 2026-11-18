/*
 * Colly service worker.
 *
 * Its only job is installability: Chrome/Edge/Android expose the
 * `beforeinstallprompt` event to a page whose app has a service worker with a
 * `fetch` listener. The listener deliberately never calls `respondWith()` and
 * the worker never opens a cache, so every request still goes straight to the
 * network. That matters for a Next.js app with server components: a cached
 * HTML shell or RSC payload would outlive a deploy, and this app ships
 * database-backed pages on every build.
 *
 * The file is served from `public/` at `/sw.js`, so its scope is `/` (the
 * whole app). `proxy.ts` excludes it from the session matcher, otherwise a
 * signed-out request would be answered with a redirect to `/login` and the
 * browser would reject the script.
 */

self.addEventListener("install", () => {
  // A new worker takes over as soon as it is installed; there is no cache to
  // warm up first.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No `respondWith()` on purpose: the browser handles the request itself, so
// nothing is ever served stale. Removing this listener makes the app
// non-installable in Chromium, so it stays even though it does nothing.
self.addEventListener("fetch", () => {});
