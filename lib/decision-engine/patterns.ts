// Milestone 14 — Learning and personalization: the "interpretable pattern
// engine" (docs/12_ROADMAP.md). Pure, synchronous frequency counting over
// the founder's own historical decisions/feedback — no machine learning,
// no opaque weights. Every number here is one a person could recompute by
// hand from the same rows, which is the whole point: docs/12_ROADMAP.md's
// Milestone 14 acceptance criteria are "deterministic cold start, minimum
// evidence thresholds, no opaque scoring," and this module is where all
// three are enforced.
//
// "Deterministic cold start": a rule with zero or few observations produces
// no insight and no scoring adjustment at all (computeRuleInsight returns
// hasEnoughEvidence: false, personalizationAdjustment: 0) — the engine
// behaves exactly as it did before Milestone 14 until real evidence exists.

export const MIN_EVIDENCE_COUNT = 5;
/** Score points, on the same ~0-40+ scale as scorer.ts's other terms
 * (impact*10, adherence*10, etc.) — small enough to nudge ranking among
 * otherwise-close candidates, never enough to override a genuinely
 * higher-impact/more-urgent candidate. */
export const MAX_PERSONALIZATION_ADJUSTMENT = 2;

export interface DecisionOutcomeRow {
  ruleId: string | null;
  status: "proposed" | "accepted" | "edited" | "completed" | "skipped";
}

export interface FeedbackRow {
  ruleId: string | null;
  useful: boolean | null;
}

export interface RulePatternSummary {
  ruleId: string;
  proposedCount: number;
  completedCount: number;
  skippedCount: number;
  usefulCount: number;
  notUsefulCount: number;
}

export interface RuleInsight extends RulePatternSummary {
  hasEnoughEvidence: boolean;
  /** completed / proposed, null when there's no history at all. */
  completionRate: number | null;
  /** useful / (useful + notUseful), null when no feedback was ever given. */
  usefulnessRate: number | null;
  /** The exact value scorer.ts's personalizationOf() would add to this
   * rule's score — always 0 when hasEnoughEvidence is false. Exposed here
   * (not just internally) so /settings/memory can show the founder the
   * precise number driving ranking, not a vague "we've learned something". */
  personalizationAdjustment: number;
}

/** Groups decision + feedback rows by ruleId. Rows with a null ruleId
 * (decisions generated before Milestone 14, which didn't persist one) are
 * silently excluded — there is nothing to attribute them to. */
export function summarizeRulePatterns(
  decisions: DecisionOutcomeRow[],
  feedback: FeedbackRow[]
): RulePatternSummary[] {
  const byRule = new Map<string, RulePatternSummary>();

  function bucket(ruleId: string): RulePatternSummary {
    let entry = byRule.get(ruleId);
    if (!entry) {
      entry = { ruleId, proposedCount: 0, completedCount: 0, skippedCount: 0, usefulCount: 0, notUsefulCount: 0 };
      byRule.set(ruleId, entry);
    }
    return entry;
  }

  for (const row of decisions) {
    if (!row.ruleId) continue;
    const entry = bucket(row.ruleId);
    entry.proposedCount += 1;
    if (row.status === "completed") entry.completedCount += 1;
    if (row.status === "skipped") entry.skippedCount += 1;
  }

  for (const row of feedback) {
    if (!row.ruleId || row.useful === null) continue;
    const entry = bucket(row.ruleId);
    if (row.useful) entry.usefulCount += 1;
    else entry.notUsefulCount += 1;
  }

  return [...byRule.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

/** Turns one rule's raw counts into an interpretable insight + the bounded
 * scoring adjustment, if (and only if) there's enough evidence. */
export function computeRuleInsight(summary: RulePatternSummary): RuleInsight {
  const hasEnoughEvidence = summary.proposedCount >= MIN_EVIDENCE_COUNT;

  const completionRate = summary.proposedCount > 0 ? summary.completedCount / summary.proposedCount : null;

  const feedbackTotal = summary.usefulCount + summary.notUsefulCount;
  const usefulnessRate = feedbackTotal > 0 ? summary.usefulCount / feedbackTotal : null;

  // Primary signal is explicit "útil/não útil" feedback; falls back to
  // completion rate (a founder who keeps completing a rule's suggestions is
  // implicitly saying it's useful) only when no explicit feedback exists
  // yet, so a rule isn't stuck at "no signal" just because the founder
  // never clicked the feedback buttons.
  const signal = usefulnessRate ?? completionRate;

  const personalizationAdjustment =
    hasEnoughEvidence && signal !== null
      ? Math.max(-MAX_PERSONALIZATION_ADJUSTMENT, Math.min(MAX_PERSONALIZATION_ADJUSTMENT, (signal - 0.5) * 2 * MAX_PERSONALIZATION_ADJUSTMENT))
      : 0;

  return { ...summary, hasEnoughEvidence, completionRate, usefulnessRate, personalizationAdjustment };
}

export function computeRuleInsights(decisions: DecisionOutcomeRow[], feedback: FeedbackRow[]): RuleInsight[] {
  return summarizeRulePatterns(decisions, feedback).map(computeRuleInsight);
}

/** The map scorer.ts's personalizationOf() reads — only rules that cleared
 * the evidence threshold get an entry, everything else is absent (treated
 * as 0 by the scorer). */
export function buildRuleAdjustments(insights: RuleInsight[]): Record<string, number> {
  const adjustments: Record<string, number> = {};
  for (const insight of insights) {
    if (insight.hasEnoughEvidence && insight.personalizationAdjustment !== 0) {
      adjustments[insight.ruleId] = insight.personalizationAdjustment;
    }
  }
  return adjustments;
}

/** Short, plain-language Portuguese description of one rule's pattern, for
 * /settings/memory — the "user-visible" half of Milestone 14's
 * "user-visible/editable memory" requirement. Never phrased as a diagnosis
 * or a claim beyond what the numbers show. */
export function describeRuleInsight(insight: RuleInsight, ruleLabel: string): string {
  if (!insight.hasEnoughEvidence) {
    return `${ruleLabel}: ainda sem histórico suficiente (${insight.proposedCount}/${MIN_EVIDENCE_COUNT} sugestões).`;
  }
  const rate = insight.usefulnessRate ?? insight.completionRate ?? 0;
  const percent = Math.round(rate * 100);
  if (rate >= 0.65) {
    return `${ruleLabel}: costumas achar útil (${percent}% das vezes) — as sugestões deste tipo aparecem com um pouco mais de destaque.`;
  }
  if (rate <= 0.35) {
    return `${ruleLabel}: raramente achas útil (${percent}% das vezes) — as sugestões deste tipo aparecem com um pouco menos de destaque. Podes silenciá-las de vez abaixo.`;
  }
  return `${ruleLabel}: resultado misto (${percent}% útil) — sem ajuste aplicado.`;
}
