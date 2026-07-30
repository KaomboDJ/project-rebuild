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

/** Tailwind class fragments for a small colored badge per domain - a soft
 * tag color per domain (Notion-style) rather than one flat brand color for
 * everything. */
export const DOMAIN_BADGE_CLASS: Record<DecisionDomain, string> = {
  training: "bg-orange-500/15 text-orange-300",
  nutrition: "bg-lime-500/15 text-lime-300",
  sleep: "bg-indigo-500/15 text-indigo-300",
  recovery: "bg-cyan-500/15 text-cyan-300",
  planning: "bg-amber-500/15 text-amber-300",
};
