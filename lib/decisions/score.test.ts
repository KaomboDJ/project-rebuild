import { describe, expect, it } from "vitest";
import { computeDecisionScore, maxPossibleScore } from "./score";
import type { DecisionInstance } from "./types";

const base: Omit<DecisionInstance, "status"> = {
  id: "x",
  title: "x",
  trigger: "x",
  scoreValue: 10,
  priority: 1,
  appliesToStates: ["consistent"],
  date: "2026-07-28",
};

describe("computeDecisionScore", () => {
  it("sums only completed decisions", () => {
    const instances: DecisionInstance[] = [
      { ...base, id: "a", status: "completed" },
      { ...base, id: "b", status: "skipped" },
      { ...base, id: "c", status: "pending" },
    ];
    expect(computeDecisionScore(instances)).toBe(10);
  });

  it("does not penalize skipped or pending decisions", () => {
    const instances: DecisionInstance[] = [
      { ...base, id: "a", status: "skipped" },
      { ...base, id: "b", status: "pending" },
    ];
    expect(computeDecisionScore(instances)).toBe(0);
  });
});

describe("maxPossibleScore", () => {
  it("sums all decision values regardless of status", () => {
    const instances: DecisionInstance[] = [
      { ...base, id: "a", status: "completed" },
      { ...base, id: "b", status: "skipped" },
    ];
    expect(maxPossibleScore(instances)).toBe(20);
  });
});
