import { describe, expect, it } from "vitest";
import type { DecisionRow } from "@/lib/decision-engine/day-plan";
import { validatePlanConflicts } from "./validate-conflicts";

function decision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: "d1", user_id: "u1", decision_run_id: "r1", date: "2026-08-03", title: "Treino",
    reason: "Janela livre", recommended_action: "Treina", recommended_start: "2026-08-03T11:00:00Z",
    recommended_end: "2026-08-03T11:40:00Z", domain: "training", impact: "high", confidence: 0.8,
    source: "rule", status: "accepted", calendar_event_id: null, calendar_connection_id: null, completed_at: null, skipped_reason: null,
    related_pantry_item: null, rule_id: "lunch-training", timing_type: "calendar_slot", trigger_label: null,
    created_at: "2026-08-03T06:00:00Z", updated_at: "2026-08-03T06:00:00Z", ...overrides,
  };
}

describe("validatePlanConflicts", () => {
  it("flags an accepted decision after a new fixed event occupies its slot", () => {
    const conflicts = validatePlanConflicts([decision()], [{
      id: "meeting", title: "Reunião", start: "2026-08-03T12:15:00", end: "2026-08-03T13:00:00", isAllDay: false,
    }], "Europe/Lisbon");
    expect(conflicts).toEqual([{ decisionId: "d1", reason: "overlaps-fixed-event" }]);
  });

  it("does not resurface completed or skipped decisions", () => {
    expect(validatePlanConflicts([decision({ status: "completed" }), decision({ id: "d2", status: "skipped" })], [], "Europe/Lisbon")).toEqual([]);
  });

  it("flags a missing external event", () => {
    expect(validatePlanConflicts([decision({ calendar_event_id: "gone" })], [], "Europe/Lisbon")).toEqual([
      { decisionId: "d1", reason: "external-event-missing" },
    ]);
  });
});
