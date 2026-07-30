// Milestone 11B — Daily Planning Engine, "Programar o meu dia" slice.
//
// Today's flow requires the founder to Accept, then separately
// Adicionar ao calendário, for each of the day's (up to three) decisions
// one at a time. This module is the pure logic behind a single batch
// action that does both steps for everything that's ready, in one tap -
// the real decision this makes easier is "do I want to process my three
// decisions one at a time this morning, or handle today's plan in one
// go." It does not change per-decision behavior: the existing Accept /
// Adicionar ao calendário buttons on DecisionEngineCard keep working
// exactly as before for anyone who prefers that.
//
// Deliberately pure and Supabase-free so it's directly unit-testable,
// matching the pattern of computeFreeWindows/mergeConnectionEvents.

import type { Database } from "@/lib/supabase/database.types";

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

/**
 * Decisions still sitting in "proposed" - these need an explicit accept
 * before they're eligible to become a calendar event. A day-plan action
 * accepts all of these first, then re-checks for schedulable decisions
 * (see decisionsNeedingCalendarEvent) against the updated rows.
 */
export function decisionsNeedingAcceptance(decisions: DecisionRow[]): DecisionRow[] {
  return decisions.filter((decision) => decision.status === "proposed");
}

/**
 * Decisions ready to become a calendar event: already actioned (accepted
 * or edited - completed/skipped decisions are never scheduled), have a
 * recommended time window, and don't already have one. Does not include
 * "proposed" decisions on its own - callers accept those first via
 * decisionsNeedingAcceptance, then run this again against the updated
 * rows, so a single day-plan action covers both without double-booking
 * a decision that already has a calendar_event_id.
 */
export function decisionsNeedingCalendarEvent(decisions: DecisionRow[]): DecisionRow[] {
  return decisions.filter(
    (decision) =>
      (decision.status === "accepted" || decision.status === "edited") &&
      Boolean(decision.recommended_start) &&
      Boolean(decision.recommended_end) &&
      !decision.calendar_event_id
  );
}

/**
 * Whether a day-plan action would do anything at all, given the current
 * decisions - used to decide whether it's worth asking which connected
 * Google account to use before running the batch (no point asking if
 * there's nothing to schedule).
 */
export function dayPlanWouldScheduleAnything(decisions: DecisionRow[]): boolean {
  const wouldAccept = decisionsNeedingAcceptance(decisions).some(
    (decision) => decision.recommended_start && decision.recommended_end
  );
  return wouldAccept || decisionsNeedingCalendarEvent(decisions).length > 0;
}
