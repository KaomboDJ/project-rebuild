import type { Database } from "@/lib/supabase/database.types";

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

export function decisionsNeedingAcceptance(decisions: DecisionRow[]): DecisionRow[] {
  return decisions.filter((decision) => decision.status === "proposed");
}

export function decisionsNeedingCalendarEvent(decisions: DecisionRow[]): DecisionRow[] {
  return decisions.filter(
    (decision) =>
      (decision.status === "accepted" || decision.status === "edited") &&
      decision.timing_type === "calendar_slot" &&
      Boolean(decision.recommended_start) &&
      Boolean(decision.recommended_end) &&
      !decision.calendar_event_id
  );
}

export function dayPlanWouldScheduleAnything(decisions: DecisionRow[]): boolean {
  return decisionsNeedingAcceptance(decisions).length > 0 || decisionsNeedingCalendarEvent(decisions).length > 0;
}
