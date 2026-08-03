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

self.addEventListener("push", (event) => {
  let payload = {
    title: "Rebuild",
    body: "Tens uma decisão importante à tua espera.",
    url: "/home",
    tag: "rebuild-reminder",
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Keep the safe generic payload when a provider sends malformed data.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      renotify: false,
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === target);
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    })
  );
});
