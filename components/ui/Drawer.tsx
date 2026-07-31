"use client";

// Shared slide-over/drawer shell (UX Hardening release, docs/17_UX_AUDIT.md
// J3-a/J3-b, confirmed P2). Before this, EventDetailDrawer.tsx and the
// mobile Coach context panel (components/coach/CoachPageClient.tsx) each
// hand-rolled their own version of this pattern, and both had the same two
// bugs: the panel used the `surface-card` treatment (3% white overlay) as
// its background, which is translucent enough that the calendar/message
// list behind it visibly bled through and overlapped the drawer's own text;
// and neither listened for Escape or managed focus at all, so a keyboard
// user had no way to close the drawer without a mouse and focus was never
// returned to whatever triggered it. Centralizing the shell here means both
// call sites (and any future one) get the fix once instead of drifting.
//
// Deliberately kept a plain component (not a <dialog> element or a third
// dependency) so it stays a small, auditable amount of code doing exactly
// three things: opaque panel background, Escape-to-close, and a focus trap
// that returns focus to the trigger on close.

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({
  onClose,
  children,
  className = "",
  labelledBy,
}: {
  onClose: () => void;
  children: React.ReactNode;
  /** Extra classes for the panel (width, alignment) - the shell only owns
   * background/border/shadow/overflow so callers keep control of layout. */
  className?: string;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the drawer so a keyboard/screen-reader user lands
    // somewhere sensible immediately, rather than staying on whatever was
    // focused behind it (which may now be visually covered).
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Return focus to whatever opened the drawer - a mouse user never
      // notices, a keyboard user otherwise loses their place entirely.
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`m-3 flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-neutral-950 shadow-card outline-none md:m-4 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
