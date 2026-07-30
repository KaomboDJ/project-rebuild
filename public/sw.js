// Minimal service worker - exists only to satisfy PWA installability
// criteria (a fetch handler is required by some browsers' install
// heuristics). Deliberately no offline caching strategy: this app is a
// server-rendered, Supabase-backed decision engine that needs live data on
// every load, so caching pages/API responses here would show stale
// decisions or a stale calendar - worse than no offline support. Revisit
// only if a real offline use case shows up.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
