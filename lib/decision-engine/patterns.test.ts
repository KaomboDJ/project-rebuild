import { describe, expect, it } from "vitest";
import {
  buildRuleAdjustments,
  computeRuleInsight,
  computeRuleInsights,
  describeRuleInsight,
  MAX_PERSONALIZATION_ADJUSTMENT,
  MIN_EVIDENCE_COUNT,
  summarizeRulePatterns,
  type DecisionOutcomeRow,
  type FeedbackRow,
} from "./patterns";

function decisions(ruleId: string, statuses: DecisionOutcomeRow["status"][]): DecisionOutcomeRow[] {
  return statuses.map((status) => ({ ruleId, status }));
}

describe("summarizeRulePatterns", () => {
  it("groups by ruleId and counts proposed/completed/skipped/useful/notUseful", () => {
    const rows = decisions("decide-dinner-early", ["completed", "completed", "skipped", "proposed"]);
    const feedback: FeedbackRow[] = [
      { ruleId: "decide-dinner-early", useful: true },
      { ruleId: "decide-dinner-early", useful: false },
    ];
    const [summary] = summarizeRulePatterns(rows, feedback);
    expect(summary).toMatchObject({
      ruleId: "decide-dinner-early",
      proposedCount: 4,
      completedCount: 2,
      skippedCount: 1,
      usefulCount: 1,
      notUsefulCount: 1,
    });
  });

  it("silently excludes rows with a null ruleId (pre-Milestone-14 decisions)", () => {
    const rows: DecisionOutcomeRow[] = [{ ruleId: null, status: "completed" }];
    const feedback: FeedbackRow[] = [{ ruleId: null, useful: true }];
    expect(summarizeRulePatterns(rows, feedback)).toHaveLength(0);
  });

  it("excludes feedback rows with useful: null (no explicit answer given)", () => {
    const feedback: FeedbackRow[] = [{ ruleId: "short-walk", useful: null }];
    const [summary] = summarizeRulePatterns([], feedback);
    expect(summary).toBeUndefined();
  });
});

describe("computeRuleInsight — deterministic cold start", () => {
  it("has no evidence and zero adjustment below MIN_EVIDENCE_COUNT", () => {
    const summary = {
      ruleId: "short-walk",
      proposedCount: MIN_EVIDENCE_COUNT - 1,
      completedCount: MIN_EVIDENCE_COUNT - 1,
      skippedCount: 0,
      usefulCount: 0,
      notUsefulCount: 0,
    };
    const insight = computeRuleInsight(summary);
    expect(insight.hasEnoughEvidence).toBe(false);
    expect(insight.personalizationAdjustment).toBe(0);
  });

  it("gains evidence exactly at MIN_EVIDENCE_COUNT", () => {
    const summary = {
      ruleId: "short-walk",
      proposedCount: MIN_EVIDENCE_COUNT,
      completedCount: MIN_EVIDENCE_COUNT,
      skippedCount: 0,
      usefulCount: 0,
      notUsefulCount: 0,
    };
    expect(computeRuleInsight(summary).hasEnoughEvidence).toBe(true);
  });
});

describe("computeRuleInsight — bounded, interpretable adjustment", () => {
  it("caps the adjustment at +MAX_PERSONALIZATION_ADJUSTMENT for all-useful feedback", () => {
    const summary = {
      ruleId: "decide-dinner-early",
      proposedCount: 10,
      completedCount: 10,
      skippedCount: 0,
      usefulCount: 10,
      notUsefulCount: 0,
    };
    expect(computeRuleInsight(summary).personalizationAdjustment).toBe(MAX_PERSONALIZATION_ADJUSTMENT);
  });

  it("caps the adjustment at -MAX_PERSONALIZATION_ADJUSTMENT for all-not-useful feedback", () => {
    const summary = {
      ruleId: "decide-dinner-early",
      proposedCount: 10,
      completedCount: 0,
      skippedCount: 10,
      usefulCount: 0,
      notUsefulCount: 10,
    };
    expect(computeRuleInsight(summary).personalizationAdjustment).toBe(-MAX_PERSONALIZATION_ADJUSTMENT);
  });

  it("produces 0 for an exactly 50/50 signal", () => {
    const summary = {
      ruleId: "decide-dinner-early",
      proposedCount: 10,
      completedCount: 5,
      skippedCount: 5,
      usefulCount: 5,
      notUsefulCount: 5,
    };
    expect(computeRuleInsight(summary).personalizationAdjustment).toBe(0);
  });

  it("falls back to completion rate when no explicit feedback was ever given", () => {
    const summary = {
      ruleId: "decide-dinner-early",
      proposedCount: 10,
      completedCount: 9,
      skippedCount: 1,
      usefulCount: 0,
      notUsefulCount: 0,
    };
    const insight = computeRuleInsight(summary);
    expect(insight.usefulnessRate).toBeNull();
    expect(insight.completionRate).toBe(0.9);
    expect(insight.personalizationAdjustment).toBeGreaterThan(0);
  });
});

describe("buildRuleAdjustments", () => {
  it("only includes rules with enough evidence and a non-zero adjustment", () => {
    const insights = computeRuleInsights(
      [...decisions("rule-a", Array(10).fill("completed")), ...decisions("rule-b", ["completed", "skipped"])],
      [
        ...Array(10).fill({ ruleId: "rule-a", useful: true }),
      ]
    );
    const adjustments = buildRuleAdjustments(insights);
    expect(adjustments["rule-a"]).toBe(MAX_PERSONALIZATION_ADJUSTMENT);
    expect(adjustments["rule-b"]).toBeUndefined(); // below MIN_EVIDENCE_COUNT
  });
});

describe("describeRuleInsight", () => {
  it("mentions the evidence threshold when there isn't enough history yet", () => {
    const insight = computeRuleInsight({
      ruleId: "short-walk",
      proposedCount: 1,
      completedCount: 0,
      skippedCount: 0,
      usefulCount: 0,
      notUsefulCount: 0,
    });
    expect(describeRuleInsight(insight, "Caminhada curta")).toContain(`1/${MIN_EVIDENCE_COUNT}`);
  });

  it("never phrases a low-usefulness rule as a diagnosis — only a suggestion to mute", () => {
    const insight = computeRuleInsight({
      ruleId: "short-walk",
      proposedCount: 10,
      completedCount: 1,
      skippedCount: 9,
      usefulCount: 0,
      notUsefulCount: 10,
    });
    const description = describeRuleInsight(insight, "Caminhada curta");
    expect(description).toContain("silenciá-las");
  });
});
