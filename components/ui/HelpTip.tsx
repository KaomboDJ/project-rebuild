"use client";

// UX Hardening release (docs/17_UX_AUDIT.md, section 4 - "lightweight help
// foundation, not the full Rebuild Guide"). One small, reusable, accessible
// info popover, used selectively for genuinely unfamiliar concepts (Decision
// Score, macro estimates, memory confidence, rule muting, destination
// calendar, ...) rather than a "?" next to every field, per the release
// brief. Deliberately NOT the six-layer Guide the audit specified for a
// later release - no route-awareness, no chat, no "why this" reasoning
// beyond what's passed in as plain copy.
//
// Accessibility requirements this satisfies (all confirmed by the Playwright
// suite's help-popover test, not just asserted here): keyboard-focusable
// trigger, opens on click AND on Enter/Space (not hover-only), closes on
// Escape, closes when focus moves outside the popover, and restores focus to
// the trigger on close.

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

export function HelpTip({ heading, children }: { heading: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handleFocusOut(event: FocusEvent) {
      const next = event.relatedTarget as Node | null;
      if (next && (popoverRef.current?.contains(next) || triggerRef.current?.contains(next))) return;
      setOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={`Mais informação: ${heading}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-neutral-400 transition hover:text-neutral-200 focus-visible:text-neutral-200"
      >
        <Info size={13} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-label={heading}
          className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-white/10 bg-neutral-900 p-3 text-xs leading-relaxed text-neutral-300 shadow-card"
        >
          <p className="mb-1 font-medium text-neutral-100">{heading}</p>
          {children}
        </div>
      )}
    </span>
  );
}
