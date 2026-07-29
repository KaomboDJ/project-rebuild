import { describe, expect, it } from "vitest";
import { baseContext } from "./fixtures";
import { computeDecisionScore, scoreCandidate } from "./scorer";
import type { DecisionCandidate } from "./types";

const CANDIDATE: DecisionCandidate = {
  ruleId: "test-rule",
  domain: "training",
  recommendedAction: "Faz isto.",
  baseTitle: "Teste",
  baseReason: "Porque sim.",
  requiresFreeWindow: false,
  baseImpact: "medium",
};

describe("scoreCandidate", () => {
  it("scores a higher-impact candidate higher, all else equal", () => {
    const context = baseContext();
    const low = scoreCandidate({ ...CANDIDATE, baseImpact: "low" }, context);
    const high = scoreCandidate({ ...CANDIDATE, baseImpact: "high" }, context);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("gives higher confidence when a check-in is present", () => {
    const withCheckIn = scoreCandidate(CANDIDATE, baseContext({ userCheckIn: { sleepQuality: 3 } }));
    const without = scoreCandidate(CANDIDATE, baseContext());
    expect(withCheckIn.confidence).toBeGreaterThan(without.confidence);
  });

  it("rewards positive historical adherence in the same domain", () => {
    const goodHistory = scoreCandidate(
      CANDIDATE,
      baseContext({
        recentDecisions: [
          { date: "2026-07-27", domain: "training", status: "completed" },
          { date: "2026-07-28", domain: "training", status: "completed" },
        ],
      })
    );
    const badHistory = scoreCandidate(
      CANDIDATE,
      baseContext({
        recentDecisions: [
          { date: "2026-07-27", domain: "training", status: "skipped" },
          { date: "2026-07-28", domain: "training", status: "skipped" },
        ],
      })
    );
    expect(goodHistory.score).toBeGreaterThan(badHistory.score);
  });

  it("never produces a negative confidence or score below zero-ish bounds", () => {
    const scored = scoreCandidate(CANDIDATE, baseContext());
    expect(scored.confidence).toBeGreaterThanOrEqual(0);
    expect(scored.confidence).toBeLessThanOrEqual(1);
  });
});

describe("computeDecisionScore", () => {
  it("awards 15/10/5 XP for completed high/medium/low impact decisions", () => {
    expect(computeDecisionScore([{ status: "completed", impact: "high" }])).toBe(15);
    expect(computeDecisionScore([{ status: "completed", impact: "medium" }])).toBe(10);
    expect(computeDecisionScore([{ status: "completed", impact: "low" }])).toBe(5);
  });

  it("awards 2 XP for accepted or edited but not completed", () => {
    expect(computeDecisionScore([{ status: "accepted", impact: "high" }])).toBe(2);
    expect(computeDecisionScore([{ status: "edited", impact: "high" }])).toBe(2);
  });

  it("never awards negative XP for a skipped decision (no-shame rule)", () => {
    expect(computeDecisionScore([{ status: "skipped", impact: "high" }])).toBe(0);
  });

  it("sums across multiple decisions", () => {
    const total = computeDecisionScore([
      { status: "completed", impact: "high" },
      { status: "completed", impact: "low" },
      { status: "skipped", impact: "medium" },
    ]);
    expect(total).toBe(20);
  });
});
