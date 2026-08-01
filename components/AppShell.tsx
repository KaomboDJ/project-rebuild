import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";

export function AppShell({
  children,
  email,
  calendarConnected = false,
}: {
  children: ReactNode;
  email?: string | null;
  calendarConnected?: boolean;
}) {
  return (
    <div className="min-h-screen bg-app text-neutral-100">
      {/* Keyboard-only escape hatch (docs/17_UX_AUDIT.md, J1): visually
          hidden until focused, so a keyboard user's very first Tab press
          offers a direct jump past the calendar/decisions content straight
          to the main region, instead of always having to tab through every
          nav item first regardless of which page they landed on. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar para o conteúdo
      </a>

      <AppNav calendarConnected={calendarConnected} />

      {/* Slim top bar, mobile only - the sidebar already carries the brand
          on desktop. Bottom padding on <main> reserves space for the fixed
          mobile tab bar so the last card is never hidden behind it. */}
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 md:hidden">
        <Link href="/home" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-700 text-[10px] font-bold text-white">
            R
          </span>
          <span className="text-sm font-semibold tracking-tight">Rebuild</span>
        </Link>
        {email && <span className="text-xs text-neutral-400">{email}</span>}
      </header>

      <div className="md:pl-60">
        <header className="hidden items-center justify-end border-b border-white/[0.06] px-8 py-3 md:flex">
          {email && <span className="text-xs text-neutral-400">{email}</span>}
        </header>
        <div id="main-content" tabIndex={-1} className="pb-20 outline-none md:pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
