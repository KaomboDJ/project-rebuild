"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck2,
  Circle,
  Dumbbell,
  History,
  Home,
  ListChecks,
  Lock,
  Menu,
  MessageCircleHeart,
  Settings,
  ShoppingBasket,
  UserCog,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { IdentityProgressCard } from "@/components/IdentityProgressCard";
import { HelpTip } from "@/components/ui/HelpTip";
import type { IdentityProgression } from "@/lib/gamification/progression";
import type { SetupStage } from "@/lib/setup/guard";

// "Calendário" was dropped as a separate nav item once /calendar started
// redirecting into the merged Calendar Workspace at /today (see
// app/(app)/calendar/page.tsx) - two nav entries pointing at the same page
// would be confusing. "Hoje" now covers both the day's decisions and the
// full calendar canvas.
//
// "Coach" and "Alimentação" added for the Coach UX + Pantry Intelligence
// milestone (Part 1/2) - previously the Coach only existed as a drawer
// inside /today, with no way to reach the full conversation-history page,
// and pantry/shopping had no route at all.
const NAV_ITEMS: {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}[] = [
  { href: "/home", label: "Início", icon: Home },
  { href: "/today", label: "Hoje", icon: ListChecks },
  { href: "/coach", label: "Coach", icon: MessageCircleHeart },
  { href: "/nutrition", label: "Alimentação", icon: ShoppingBasket },
  { href: "/training", label: "Treino", icon: Dumbbell },
  { href: "/history", label: "Histórico", icon: History },
  { href: "/settings", label: "Definições", icon: Settings },
];

// While the user hasn't finished the mandatory setup gate (see
// lib/setup/guard.ts), most destinations would just bounce them straight
// back via requireSetupComplete. Rather than show nav items that dead-end
// in a redirect, only surface the item(s) relevant to the current stage.
// "done" (the normal case) shows everything, as before.
const STAGE_VISIBLE_HREFS: Record<SetupStage, string[] | null> = {
  calendar: ["/settings"],
  training: ["/settings", "/training"],
  done: null,
};
// Sub-menu shown in the desktop sidebar while the mandatory setup gate isn't
// finished yet. "Calendário" and "Perfil" both live on /settings and are
// reachable from stage "calendar" onward; "Plano de Treino" only unlocks once
// the user reaches stage "training"; "Plano de Alimentação" stays locked the
// whole time the gate is up, since it only becomes relevant once setup is done.
type SetupNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  unlocked: (stage: SetupStage) => boolean;
  // Shown in a HelpTip next to the lock icon when unlocked() is false, so
  // the reason for a locked item is actually visible on hover/tap instead
  // of relying on a native title="" tooltip (easy to miss / doesn't work
  // well on touch).
  lockedReason: string;
};

const SETUP_NAV_ITEMS: SetupNavItem[] = [
  {
    href: "/settings#calendario",
    label: "Calendário",
    icon: CalendarCheck2,
    unlocked: () => true,
    lockedReason: "",
  },
  {
    href: "/settings#perfil",
    label: "Perfil",
    icon: UserCog,
    unlocked: () => true,
    lockedReason: "",
  },
  {
    href: "/training/profile",
    label: "Plano de Treino",
    icon: Dumbbell,
    unlocked: (stage) => stage === "training",
    lockedReason: "Disponível depois de ligares um calendário - é o próximo passo da configuração.",
  },
  {
    href: "/nutrition",
    label: "Plano de Alimentação",
    icon: ShoppingBasket,
    unlocked: () => false,
    lockedReason:
      "Disponível depois de terminares a configuração inicial (calendário e plano de treino).",
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sidebar on desktop (md+), fixed bottom tab bar on mobile - the layout
 * every installed-PWA/productivity app (Linear, Notion, Fantastical) uses,
 * instead of the previous plain text links in a single top header. Split
 * into its own client component because active-route highlighting needs
 * usePathname(), while AppShell itself stays a server component.
 */
export function AppNav({
  calendarConnected = false,
  setupStage = "done",
  progression,
}: {
  calendarConnected?: boolean;
  setupStage?: SetupStage;
  progression?: IdentityProgression;
}) {
  const pathname = usePathname();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreCloseRef = useRef<HTMLButtonElement>(null);
  const visibleHrefs = STAGE_VISIBLE_HREFS[setupStage];
  const visibleItems = visibleHrefs
    ? NAV_ITEMS.filter((item) => visibleHrefs.includes(item.href))
    : NAV_ITEMS;
  const mobilePrimaryItems = NAV_ITEMS.filter((item) =>
    ["/home", "/today", "/coach", "/nutrition"].includes(item.href)
  );
  const mobileMoreItems = NAV_ITEMS.filter((item) =>
    ["/training", "/history", "/settings"].includes(item.href)
  );
  const mobileMoreActive = mobileMoreItems.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!mobileMoreOpen) return;

    mobileMoreCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMoreOpen(false);
      mobileMoreButtonRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMoreOpen]);

  const closeMobileMore = () => {
    setMobileMoreOpen(false);
    mobileMoreButtonRef.current?.focus();
  };

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-white/[0.06] bg-[#0b0d10]/92 px-3 py-5 backdrop-blur-xl md:flex"
      >
        <Link href="/home" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-700 text-xs font-black text-[#04110d] shadow-lg shadow-emerald-950/50">
            R
          </span>
          <span>
            <span className="block font-semibold tracking-tight text-white">Rebuild</span>
            <span className="block text-[9px] uppercase tracking-[0.16em] text-neutral-600">
              Decision OS
            </span>
          </span>
        </Link>
        {setupStage !== "done" ? (
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Configuração
            </p>
            {SETUP_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              if (!item.unlocked(setupStage)) {
                return (
                  <span
                    key={item.href}
                    className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-neutral-600"
                  >
                    <Icon size={18} strokeWidth={2} />
                    {item.label}
                    <span className="ml-auto flex items-center gap-1">
                      <Lock size={13} />
                      <HelpTip heading={item.label}>{item.lockedReason}</HelpTip>
                    </span>
                  </span>
                );
              }
              const active = isActive(pathname, item.href.split("#")[0]);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-100"
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
              O teu sistema
            </p>
            {visibleItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "border border-emerald-400/10 bg-gradient-to-r from-emerald-400/[0.13] to-teal-400/[0.035] text-emerald-200 shadow-sm"
                      : "text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-100"
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
        <div className="my-4 border-t border-white/[0.06]" />
        {progression && <IdentityProgressCard progression={progression} compact />}
        <div className="mt-auto pt-4">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-neutral-400 transition hover:bg-white/[0.05] hover:text-neutral-300"
          >
            <Circle
              size={8}
              className={
                calendarConnected
                  ? "fill-emerald-500 text-emerald-500"
                  : "fill-neutral-600 text-neutral-400"
              }
            />
            {calendarConnected ? "Calendário ligado" : "Calendário por ligar"}
          </Link>
        </div>
      </nav>
      {setupStage === "done" ? (
        <>
          {mobileMoreOpen && (
            <div className="fixed inset-0 z-30 md:hidden" role="presentation">
              <button
                type="button"
                aria-label="Fechar menu"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={closeMobileMore}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Mais opções"
                className="absolute inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] rounded-3xl border border-white/10 bg-[#111318] p-3 shadow-2xl"
              >
                <div className="flex items-center justify-between px-2 pb-2">
                  <div>
                    <p className="text-sm font-semibold text-white">Mais opções</p>
                    <p className="text-xs text-neutral-500">O essencial fica sempre a um toque.</p>
                  </div>
                  <button
                    type="button"
                    ref={mobileMoreCloseRef}
                    aria-label="Fechar menu"
                    className="btn-ghost h-9 w-9 rounded-full p-0"
                    onClick={closeMobileMore}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {mobileMoreItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMoreOpen(false)}
                        className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border text-xs font-medium transition ${
                          active
                            ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-200"
                            : "border-white/[0.06] bg-white/[0.035] text-neutral-300"
                        }`}
                      >
                        <Icon size={21} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
          <nav
            aria-label="Navegação principal"
            className="mobile-dock fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 rounded-[1.35rem] border border-white/10 bg-[#111318]/95 px-1 shadow-2xl shadow-black/50 backdrop-blur-xl md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {mobilePrimaryItems.slice(0, 2).map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-dock-item ${active ? "is-active" : ""}`}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {mobilePrimaryItems.slice(2, 3).map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col items-center justify-end pb-2 text-[10px] font-semibold text-emerald-200"
                >
                  <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-[#04110d] shadow-lg shadow-emerald-950/60 transition group-active:scale-95">
                    <Icon size={23} strokeWidth={2.4} />
                  </span>
                  <span className="mt-1">Coach</span>
                </Link>
              );
            })}
            {mobilePrimaryItems.slice(3).map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-dock-item ${active ? "is-active" : ""}`}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              ref={mobileMoreButtonRef}
              aria-label="Mais opções"
              aria-expanded={mobileMoreOpen}
              className={`mobile-dock-item ${mobileMoreActive || mobileMoreOpen ? "is-active" : ""}`}
              onClick={() => setMobileMoreOpen((open) => !open)}
            >
              <Menu size={20} strokeWidth={mobileMoreActive ? 2.5 : 2} />
              <span>Mais</span>
            </button>
          </nav>
        </>
      ) : (
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-20 flex border-t border-white/[0.06] bg-app/95 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {visibleItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                  active ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
