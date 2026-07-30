"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js on mount. Client component (registration needs
 * `navigator.serviceWorker`, a browser-only API), mounted once from the
 * root layout so it runs on every page.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal - the app works fully without the service worker, it just
      // won't be installable in browsers that require one.
    });
  }, []);

  return null;
}
