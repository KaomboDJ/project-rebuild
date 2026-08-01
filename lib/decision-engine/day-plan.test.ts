import { describe, expect, it } from "vitest";
import {
  dayPlanWouldScheduleAnything,
  decisionsNeedingAcceptance,
  decisionsNeedingCalendarEvent,
  type DecisionRow,
} from "./day-plan";

function decision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: "d1", user_id: "u1", decision_run_id: "r1", date: "2026-07-30",
    title: "Treino ao almoço", reason: "Janela livre às 12:30.", recommended_action: "Faz 30 minutos.",
    recommended_start: "2026-07-30T12:30:00Z", recommended_end: "2026-07-30T13:00:00Z",
    domain: "training", impact: "high", confidence: 0.8, source: "rule", status: "proposed",
    calendar_event_id: null, calendar_connection_id: null, completed_at: null, skipped_reason: null, related_pantry_item: null,
    rule_id: null, timing_type: "calendar_slot", trigger_label: null,
    created_at: "2026-07-30T06:00:00Z", updated_at: "2026-07-30T06:00:00Z", ...overrides,
  };
}

describe("day plan lifecycle", () => {
  it("accepts every proposed decision, including trigger-based decisions without a time", () => {
    const proposed = decision({ timing_type: "trigger_based", recommended_start: null, recommended_end: null });
    expect(decisionsNeedingAcceptance([proposed, decision({ id: "a", status: "accepted" })])).toEqual([proposed]);
  });

  it("schedules only accepted or edited calendar-slot decisions with a complete unused window", () => {
    const accepted = decision({ id: "a", status: "accepted" });
    const edited = decision({ id: "b", status: "edited" });
    const proposed = decision({ id: "c" });
    const trigger = decision({ id: "d", status: "accepted", timing_type: "trigger_based" });
    const scheduled = decision({ id: "e", status: "accepted", calendar_event_id: "gcal" });
    const incomplete = decision({ id: "f", status: "accepted", recommended_end: null });
    expect(decisionsNeedingCalendarEvent([accepted, edited, proposed, trigger, scheduled, incomplete]).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("reports work while anything needs acceptance or external scheduling", () => {
    expect(dayPlanWouldScheduleAnything([decision()])).toBe(true);
    expect(dayPlanWouldScheduleAnything([decision({ status: "accepted" })])).toBe(true);
  });

  it("reports no work when decisions are scheduled, resolved, or local-only accepted", () => {
    expect(dayPlanWouldScheduleAnything([
      decision({ status: "accepted", calendar_event_id: "gcal" }),
      decision({ id: "b", status: "completed" }),
      decision({ id: "c", status: "skipped" }),
      decision({ id: "d", status: "accepted", timing_type: "flexible" }),
    ])).toBe(false);
    expect(dayPlanWouldScheduleAnything([])).toBe(false);
  });
});
