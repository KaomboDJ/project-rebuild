// Visual identity (icon + accent color) per decision domain - shared by
// components/DecisionEngineCard.tsx (client) and /history (server
// component); lucide-react icon components render fine on either side, so
// this stays alongside the pure labels.ts rather than needing a "use
// client" boundary of its own.

import { CalendarClock, Dumbbell, HeartPulse, Moon, Utensils } from "lucide-react";
import type { ComponentType } from "react";
import type { DecisionDomain } from "./types";

export const DOMAIN_ICON: Record<DecisionDomain, ComponentType<{ size?: number; className?: string }>> = {
  training: Dumbbell,
  nutrition: Utensils,
  sleep: Moon,
  recovery: HeartPulse,
  planning: CalendarClock,
};

/** Tailwind class fragments for a small colored badge per domain. Per the
 * Calendar Workspace visual spec: training=violet, nutrition=amber,
 * sleep=indigo, recovery=cyan, planning=gray - emerald is reserved for
 * confirmed/completed actions, not used here. */
export const DOMAIN_BADGE_CLASS: Record<DecisionDomain, string> = {
  training: "bg-violet-500/15 text-violet-300",
  nutrition: "bg-amber-500/15 text-amber-300",
  sleep: "bg-indigo-500/15 text-indigo-300",
  recovery: "bg-cyan-500/15 text-cyan-300",
  planning: "bg-neutral-500/15 text-neutral-300",
};

/** Same palette as hex values, for contexts that need an inline style
 * instead of a Tailwind class (FullCalendar event colors are set via JS,
 * not className). */
export const DOMAIN_HEX: Record<DecisionDomain, string> = {
  training: "#8b5cf6",
  nutrition: "#f59e0b",
  sleep: "#6366f1",
  recovery: "#06b6d4",
  planning: "#a3a3a3",
};
