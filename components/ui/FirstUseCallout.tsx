"use client";

// UX Hardening release (docs/17_UX_AUDIT.md, section 4 - first-use
// guidance). One short, dismissible callout per complex area, never a
// forced multi-step tour, per the release brief and the founder's own
// "reduce cognitive load" product philosophy. Dismissal is stored in
// localStorage keyed by `id` - a per-browser, not a per-account, dismissal.
// That's a deliberate, documented scope choice for this release: true
// per-user persistence (surviving a reinstall or a new device) would need a
// new column/table and an API round-trip for what is a one-line, low-stakes
// hint, which is more than this lightweight foundation calls for. Noted
// explicitly rather than silently presented as fully per-user.

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_PREFIX = "rebuild:dismissed-callout:";

export function FirstUseCallout({ id, children }: { id: string; children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(true); // default hidden until we know localStorage says otherwise - avoids a flash on every visit for returning users.

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_PREFIX + id) === "1");
    } catch {
      setDismissed(false);
    }
  }, [id]);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_PREFIX + id, "1");
    } catch {
      // Private browsing / storage disabled - dismissal just won't persist
      // across reloads, which is a safe degradation, not a broken feature.
    }
  }

  if (dismissed) return null;

  return (
    <div role="note" className="surface-card flex items-start justify-between gap-3 border-emerald-500/20 p-3.5 text-sm">
      <div className="text-neutral-300">{children}</div>
      <button
        aria-label="Dispensar"
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1 text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200"
      >
        <X size={14} />
      </button>
    </div>
  );
}
