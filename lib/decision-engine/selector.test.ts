import { describe, expect, it } from "vitest";
import { baseContext } from "./fixtures";
import { selectThree } from "./selector";
import type { ScoredCandidate } from "./types";

function candidate(overrides: Partial<ScoredCandidate>): ScoredCandidate {
  return {
    ruleId: "test",
    domain: "training",
    recommendedAction: "Faz isto.",
    baseTitle: "Teste",
    baseReason: "Porque sim.",
    requiresFreeWindow: false,
    baseImpact: "medium",
    score: 10,
    confidence: 0.7,
    timingType: "flexible",
    ...overrides,
  };
}

describe("selectThree", () => {
  it("returns at most three", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      candidate({ ruleId: `r${i}`, domain: i % 2 === 0 ? "training" : "nutrition", score: i })
    );
    expect(selectThree(many, baseContext())).toHaveLength(3);
  });

  it("prefers domain diversity when enough domains have eligible candidates", () => {
    const candidates = [
      candidate({ ruleId: "a", domain: "training", score: 30 }),
      candidate({ ruleId: "b", domain: "training", score: 25 }),
      candidate({ ruleId: "c", domain: "nutrition", score: 20 }),
      candidate({ ruleId: "d", domain: "sleep", score: 15 }),
    ];
    const selected = selectThree(candidates, baseContext());
    const domains = selected.map((s) => s.domain);
    expect(new Set(domains).size).toBe(3);
    expect(domains).toContain("training");
    expect(domains).toContain("nutrition");
    expect(domains).toContain("sleep");
  });

  it("allows repeating a domain when too few domains have eligible candidates", () => {
    const candidates = [
      candidate({ ruleId: "a", domain: "training", score: 30 }),
      candidate({ ruleId: "b", domain: "training", score: 25 }),
      candidate({ ruleId: "c", domain: "training", score: 20 }),
    ];
    const selected = selectThree(candidates, baseContext());
    expect(selected).toHaveLength(3);
  });

  it("never selects two candidates that overlap in time", () => {
    const candidates = [
      candidate({
        ruleId: "a",
        domain: "training",
        score: 30,
        recommendedStart: "2026-07-29T12:00:00",
        recommendedEnd: "2026-07-29T12:40:00",
      }),
      candidate({
        ruleId: "b",
        domain: "nutrition",
        score: 25,
        recommendedStart: "2026-07-29T12:15:00",
        recommendedEnd: "2026-07-29T12:45:00",
      }),
      candidate({ ruleId: "c", domain: "sleep", score: 20 }),
    ];
    const selected = selectThree(candidates, baseContext());
    expect(selected.map((s) => s.ruleId)).not.toEqual(
      expect.arrayContaining(["a", "b"])
    );
    expect(selected.some((s) => s.ruleId === "a" || s.ruleId === "b")).toBe(true);
  });

  it("excludes a candidate that conflicts with a real calendar event", () => {
    const candidates = [
      candidate({
        ruleId: "a",
        domain: "training",
        score: 30,
        recommendedStart: "2026-07-29T12:00:00",
        recommendedEnd: "2026-07-29T12:40:00",
      }),
    ];
    const context = baseContext({
      calendarEvents: [
        { id: "e1", title: "Reunião", start: "2026-07-29T12:10:00", end: "2026-07-29T12:30:00", isAllDay: false },
      ],
    });
    expect(selectThree(candidates, context)).toHaveLength(0);
  });

  it("picks the highest-value candidates, not just the first generated", () => {
    const candidates = [
      candidate({ ruleId: "low", domain: "training", score: 5 }),
      candidate({ ruleId: "high", domain: "training", score: 50 }),
    ];
    const selected = selectThree(candidates, baseContext());
    expect(selected[0].ruleId).toBe("high");
  });

  it("returns fewer than three when the pool genuinely has fewer", () => {
    const candidates = [candidate({ ruleId: "only", domain: "training", score: 10 })];
    expect(selectThree(candidates, baseContext())).toHaveLength(1);
  });
});
