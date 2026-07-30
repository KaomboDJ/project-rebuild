import { describe, expect, it } from "vitest";
import {
  dayPlanWouldScheduleAnything,
  decisionsNeedingAcceptance,
  decisionsNeedingCalendarEvent,
  type DecisionRow,
} from "./day-plan";

function decision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: "d1",
    user_id: "u1",
    decision_run_id: "r1",
    date: "2026-07-30",
    title: "Treino ao almoço",
    reason: "Janela livre às 12:30.",
    recommended_action: "Faz 30 minutos de P90X3.",
    recommended_start: "2026-07-30T12:30:00Z",
    recommended_end: "2026-07-30T13:00:00Z",
    domain: "training",
    impact: "high",
    confidence: 0.8,
    source: "rule",
    status: "proposed",
    calendar_event_id: null,
    completed_at: null,
    skipped_reason: null,
    related_pantry_item: null,
    created_at: "2026-07-30T06:00:00Z",
    updated_at: "2026-07-30T06:00:00Z",
    ...overrides,
  };
}

describe("decisionsNeedingAcceptance - Milestone 11B day plan", () => {
  it("returns only proposed decisions", () => {
    const proposed = decision({ id: "a", status: "proposed" });
    const accepted = decision({ id: "b", status: "accepted" });
    const completed = decision({ id: "c", status: "completed" });
    const skipped = decision({ id: "d", status: "skipped" });

    expect(decisionsNeedingAcceptance([proposed, accepted, completed, skipped])).toEqual([proposed]);
  });

  it("returns an empty list when nothing is proposed", () => {
    expect(decisionsNeedingAcceptance([decision({ status: "accepted" })])).toEqual([]);
  });
});

describe("decisionsNeedingCalendarEvent - Milestone 11B day plan", () => {
  it("includes accepted and edited decisions with a time window and no event yet", () => {
    const accepted = decision({ id: "a", status: "accepted" });
    const edited = decision({ id: "b", status: "edited" });

    expect(decisionsNeedingCalendarEvent([accepted, edited]).map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("excludes proposed decisions - those must be accepted first", () => {
    expect(decisionsNeedingCalendarEvent([decision({ status: "proposed" })])).toEqual([]);
  });

  it("excludes completed and skipped decisions", () => {
    expect(decisionsNeedingCalendarEvent([decision({ status: "completed" })])).toEqual([]);
    expect(decisionsNeedingCalendarEvent([decision({ status: "skipped" })])).toEqual([]);
  });

  it("excludes decisions without a full time window", () => {
    expect(
      decisionsNeedingCalendarEvent([decision({ status: "accepted", recommended_start: null })])
    ).toEqual([]);
    expect(
      decisionsNeedingCalendarEvent([decision({ status: "accepted", recommended_end: null })])
    ).toEqual([]);
  });

  it("excludes decisions that already have a calendar event", () => {
    expect(
      decisionsNeedingCalendarEvent([decision({ status: "accepted", calendar_event_id: "gcal-1" })])
    ).toEqual([]);
  });
});

describe("dayPlanWouldScheduleAnything - Milestone 11B day plan", () => {
  it("is true when a proposed decision has a time window", () => {
    expect(dayPlanWouldScheduleAnything([decision({ status: "proposed" })])).toBe(true);
  });

  it("is true when an already-accepted decision still needs a calendar event", () => {
    expect(dayPlanWouldScheduleAnything([decision({ status: "accepted" })])).toBe(true);
  });

  it("is false when everything is already scheduled or has no time window", () => {
    const alreadyScheduled = decision({ status: "accepted", calendar_event_id: "gcal-1" });
    const noWindow = decision({
      status: "proposed",
      recommended_start: null,
      recommended_end: null,
    });
    expect(dayPlanWouldScheduleAnything([alreadyScheduled, noWindow])).toBe(false);
  });

  it("is false for an empty list", () => {
    expect(dayPlanWouldScheduleAnything([])).toBe(false);
  });
});
