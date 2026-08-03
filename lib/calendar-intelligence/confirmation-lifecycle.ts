// Mandatory-confirmation state machine (founder's brief): "The system may
// propose a different training or meal time, but must never silently
// reschedule it." Every transition below is explicit and one-directional —
// there is no path from "conflict_detected" straight to "accepted" without
// passing through "awaiting_confirmation", and nothing in this file ever
// mutates a plan on its own; it only computes what the *next* state would
// be given an event, for a caller (an API route) to persist.

export type CalendarInterventionStatus =
  | "planned"
  | "conflict_detected"
  | "alternative_proposed"
  | "awaiting_confirmation"
  | "accepted"
  | "rejected"
  | "kept_original"
  | "skipped";

export interface AlternativeOption {
  start: string;
  end: string;
  /** Short human-readable reason this alternative was ranked where it was, e.g. "protege o tempo em família". */
  reason?: string;
}

export type LifecycleEvent =
  | { type: "conflict_found" }
  | { type: "alternatives_ready"; alternatives: AlternativeOption[] }
  | { type: "present_to_user" }
  | { type: "user_accepted"; chosen: AlternativeOption }
  | { type: "user_kept_original" }
  | { type: "user_rejected_all" }
  | { type: "user_skipped" };

export interface CalendarInterventionState {
  status: CalendarInterventionStatus;
  alternatives: AlternativeOption[];
  chosen?: AlternativeOption;
}

const ALLOWED_TRANSITIONS: Record<CalendarInterventionStatus, LifecycleEvent["type"][]> = {
  planned: ["conflict_found"],
  conflict_detected: ["alternatives_ready"],
  alternative_proposed: ["present_to_user"],
  awaiting_confirmation: ["user_accepted", "user_kept_original", "user_rejected_all", "user_skipped"],
  // Terminal states: nothing may transition out of them automatically. A
  // fresh cycle (e.g. tomorrow's plan) starts a new state object rather
  // than mutating a terminal one.
  accepted: [],
  rejected: [],
  kept_original: [],
  skipped: [],
};

export function initialInterventionState(): CalendarInterventionState {
  return { status: "planned", alternatives: [] };
}

/**
 * Computes the next state for one lifecycle event. Returns the *same*
 * state object (not a new one) if the transition isn't allowed from the
 * current status — this is a deliberate no-op rather than a thrown error,
 * so a caller that double-fires an event (e.g. a retried request) can't
 * accidentally skip a required confirmation step.
 */
export function applyInterventionEvent(
  state: CalendarInterventionState,
  event: LifecycleEvent
): CalendarInterventionState {
  if (!ALLOWED_TRANSITIONS[state.status].includes(event.type)) {
    return state;
  }

  switch (event.type) {
    case "conflict_found":
      return { ...state, status: "conflict_detected" };
    case "alternatives_ready":
      return { ...state, status: "alternative_proposed", alternatives: event.alternatives };
    case "present_to_user":
      return { ...state, status: "awaiting_confirmation" };
    case "user_accepted":
      return { ...state, status: "accepted", chosen: event.chosen };
    case "user_kept_original":
      return { ...state, status: "kept_original" };
    case "user_rejected_all":
      return { ...state, status: "rejected" };
    case "user_skipped":
      return { ...state, status: "skipped" };
  }
}

/** True for any status that requires the founder to have made an explicit
 * choice before the plan may change — used by API routes as a guard so a
 * plan can never be mutated from a route that only received an
 * automatically-generated alternative, without a corresponding user action
 * in the request. */
export function isAwaitingExplicitConfirmation(status: CalendarInterventionStatus): boolean {
  return status === "awaiting_confirmation";
}
