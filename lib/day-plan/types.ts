import type { DecisionRow } from "@/lib/decision-engine/day-plan";
import type { CalendarEvent, FreeWindow } from "@/lib/decision-engine/types";

export type DayPlanItemKind =
  | "calendar_event"
  | "decision"
  | "meal"
  | "training"
  | "recovery"
  | "preparation"
  | "free_window";

export type DayPlanItemStatus = "fixed" | "proposed" | "accepted" | "completed" | "stale";

export interface DayPlanItem {
  id: string;
  kind: DayPlanItemKind;
  status: DayPlanItemStatus;
  /** Naive local wall-clock ISO. Null for trigger-based/flexible items. */
  startsAt: string | null;
  endsAt: string | null;
  title: string;
  explanation?: string;
  source: "calendar" | "decision_engine" | "nutrition" | "user";
  calendarSourceId?: string;
  relatedDecisionId?: string;
  relatedMealPlanEntryId?: string;
  relatedPantryItemId?: string;
  isStale?: boolean;
}

export type PlanBannerState =
  | "not_planned"
  | "proposed_awaiting_confirmation"
  | "confirmed"
  | "confirmed_with_conflict";

export interface DayPlan {
  date: string;
  timezone: string;
  now: string;
  preferredName: string;
  operatingState: "recovery" | "survival" | "performer" | "consistent" | "unknown";
  hasCheckIn: boolean;
  hasCalendarConnection: boolean;
  items: DayPlanItem[];
  nextAction: DayPlanItem | null;
  bannerState: PlanBannerState;
  planConfirmedAt: string | null;
  decisionsStale: boolean;
  briefingSummary: string | null;
  dayStart: string;
  dayEnd: string;
  freeWindows: FreeWindow[];
  calendarEvents: CalendarEvent[];
  decisions: DecisionRow[];
}
