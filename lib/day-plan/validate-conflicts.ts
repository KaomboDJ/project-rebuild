import type { DecisionRow } from "@/lib/decision-engine/day-plan";
import type { CalendarEvent } from "@/lib/decision-engine/types";
import { instantToLocalWallClockIso } from "@/lib/date/timezone";
import { overlapsFixedEvent } from "./slot-finder";

export interface PlanConflict {
  decisionId: string;
  reason: "overlaps-fixed-event" | "external-event-missing";
}

export function validatePlanConflicts(
  decisions: DecisionRow[],
  calendarEvents: CalendarEvent[],
  timezone: string
): PlanConflict[] {
  const conflicts: PlanConflict[] = [];
  const eventIds = new Set(calendarEvents.map((event) => event.id));
  for (const decision of decisions) {
    if (decision.status !== "accepted" && decision.status !== "edited") continue;
    if (decision.recommended_start && decision.recommended_end) {
      const otherEvents = decision.calendar_event_id
        ? calendarEvents.filter((event) => event.id !== decision.calendar_event_id)
        : calendarEvents;
      const localStart = instantToLocalWallClockIso(new Date(decision.recommended_start), timezone);
      const localEnd = instantToLocalWallClockIso(new Date(decision.recommended_end), timezone);
      if (overlapsFixedEvent(localStart, localEnd, otherEvents)) {
        conflicts.push({ decisionId: decision.id, reason: "overlaps-fixed-event" });
        continue;
      }
    }
    if (decision.calendar_event_id && !eventIds.has(decision.calendar_event_id)) {
      conflicts.push({ decisionId: decision.id, reason: "external-event-missing" });
    }
  }
  return conflicts;
}
