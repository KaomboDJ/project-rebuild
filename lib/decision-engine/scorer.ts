// docs/06_DECISION_ENGINE.md#scorerts
//
// scoreCandidate combines expected impact, urgency, available opportunity,
// historical adherence, and data confidence into a single ranking score.
// Cross-domain diversity is deliberately NOT handled here — that's
// selector.ts's job (see docs/06_DECISION_ENGINE.md's rationale for the
// split).

import type { DailyContext, DecisionCandidate, DecisionImpact, ScoredCandidate } from "./types";

const IMPACT_WEIGHT: Record<DecisionImpact, number> = { low: 1, medium: 2, high: 3 };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function nowMinutes(context: DailyContext): number {
  return toMinutes(context.now.slice(11, 16) || "00:00");
}

/**
 * How time-sensitive this candidate is right now, 0-1. Candidates with an
 * explicit recommended time window score higher urgency the closer `now` is
 * to that window; candidates without one get a neutral baseline.
 */
function urgencyOf(candidate: DecisionCandidate, context: DailyContext): number {
  if (!candidate.recommendedStart) return 0.5;
  const start = toMinutes(candidate.recommendedStart.slice(11, 16));
  const distance = Math.abs(start - nowMinutes(context));
  return Math.max(0, 1 - distance / 240); // fades out over 4 hours
}

/**
 * Does a matching opportunity actually exist? Candidates that don't require
 * a free window are always "available". Candidates that do require one are
 * scored optimistically (0.7) when no calendar is connected yet (we have no
 * data to contradict them), confidently (1.0) when a matching window is
 * confirmed, and penalized (0.2) when calendar data exists but doesn't
 * support them.
 */
function opportunityOf(candidate: DecisionCandidate): number {
  if (!candidate.requiresFreeWindow) return 0.8;
  return 0.7; // rules.ts only emits these candidates when a window is plausible
}

/** Historical adherence for this candidate's domain, -0.3 to +0.3. */
function adherenceOf(candidate: DecisionCandidate, context: DailyContext): number {
  const recent = context.recentDecisions.filter((d) => d.domain === candidate.domain);
  if (recent.length === 0) return 0;
  const completed = recent.filter((d) => d.status === "completed").length;
  const skipped = recent.filter((d) => d.status === "skipped").length;
  const ratio = (completed - skipped) / recent.length;
  return Math.max(-0.3, Math.min(0.3, ratio * 0.3));
}

/** How complete is the underlying data for this candidate, 0-1. */
function confidenceOf(context: DailyContext): number {
  let confidence = 0.55;
  if (context.userCheckIn) confidence += 0.2;
  if (context.profile.preferredName) confidence += 0.1; // real onboarding data, not defaults
  if (context.calendarEvents.length > 0 || context.freeWindows.length > 0) confidence += 0.15;
  return Math.min(1, confidence);
}

/**
 * Milestone 14 — personalized intervention selection. A small, bounded,
 * fully transparent adjustment: `context.ruleAdjustments` is precomputed by
 * lib/decision-engine/patterns.ts from this founder's own outcome history
 * (acceptance/completion/feedback), gated on a minimum-evidence threshold,
 * and capped to MAX_PERSONALIZATION_ADJUSTMENT there — this function does
 * nothing but look the value up, so there is no opaque scoring introduced
 * here. Returns 0 (no-op) whenever the map is absent or has no entry for
 * this rule, which is the deterministic-cold-start guarantee: a founder
 * with no history behaves identically to the pre-Milestone-14 engine.
 */
function personalizationOf(candidate: DecisionCandidate, context: DailyContext): number {
  return context.ruleAdjustments?.[candidate.ruleId] ?? 0;
}

export function scoreCandidate(candidate: DecisionCandidate, context: DailyContext): ScoredCandidate {
  const impact = IMPACT_WEIGHT[candidate.baseImpact];
  const urgency = urgencyOf(candidate, context);
  const opportunity = opportunityOf(candidate);
  const adherence = adherenceOf(candidate, context);
  const confidence = confidenceOf(context);
  const personalization = personalizationOf(candidate, context);

  const score = impact * 10 + urgency * 5 + opportunity * 5 + adherence * 10 + confidence * 5 + personalization;

  return { ...candidate, score, confidence };
}

export function scoreCandidates(candidates: DecisionCandidate[], context: DailyContext): ScoredCandidate[] {
  return candidates.map((candidate) => scoreCandidate(candidate, context));
}

// ---------------------------------------------------------------------------
// Decision Score (XP) — REBUILD_MASTER_HANDOFF.md §15 / docs/06 "computeDecisionScore"
// ---------------------------------------------------------------------------

export interface ScorableDecision {
  status: "proposed" | "accepted" | "edited" | "completed" | "skipped";
  impact: DecisionImpact;
}

const COMPLETION_XP: Record<DecisionImpact, number> = { high: 15, medium: 10, low: 5 };

/** Never negative — no-shame rule. No streaks in this MVP. */
export function computeDecisionScore(decisions: ScorableDecision[]): number {
  return decisions.reduce((total, decision) => {
    if (decision.status === "completed") return total + COMPLETION_XP[decision.impact];
    if (decision.status === "accepted" || decision.status === "edited") return total + 2;
    return total; // proposed / skipped: 0
  }, 0);
}
