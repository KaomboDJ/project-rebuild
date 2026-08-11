// Shared types for the deterministic Decision Engine (Milestone 4) and the
// AI refinement layer (Milestone 7). See docs/06_DECISION_ENGINE.md,
// docs/07_DECISION_CATALOG.md, docs/08_AI_ARCHITECTURE.md.
//
// These are in-memory shapes used while generating a day's decisions. The
// persisted shapes (`decisions`, `decision_runs` rows) live in
// lib/supabase/database.types.ts and are mapped to/from these in
// context-builder.ts / the API routes — they are related but not identical.

export type DecisionDomain = "training" | "nutrition" | "sleep" | "recovery" | "planning";
export type DecisionImpact = "low" | "medium" | "high";
export type DecisionSource = "rule" | "ai" | "hybrid";
export type DecisionStatus = "proposed" | "accepted" | "edited" | "completed" | "skipped";
export type DecisionTimingType = "calendar_slot" | "trigger_based" | "flexible";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;
  isAllDay: boolean;
  location?: string;
}

export interface FreeWindow {
  start: string; // ISO 8601
  end: string;
  durationMinutes: number;
}

export interface UserProfile {
  userId: string;
  preferredName: string;
  timezone: string;
  currentIdentity: string;
  desiredIdentity: string;
  primaryObjective:
    | "rebuild-fitness"
    | "lose-weight"
    | "train-consistently"
    | "improve-nutrition"
    | "improve-sleep";
  preferredTrainingDays: string[]; // e.g. ["monday", "wednesday"]
  preferredTrainingTime: string; // "HH:MM"
  typicalDinnerTime: string; // "HH:MM"
  targetSleepTime: string; // "HH:MM"
  targetWakeTime: string; // "HH:MM"
  weekendSleepTime: string | null;
  weekendWakeTime: string | null;
  windDownMinutes: number;
  sleepScheduleType: "regular" | "shift";
  workingHours: { start: string; end: string };
  currentConstraints: string;
  interventionTone: string;
}

export interface DailyCheckIn {
  sleepQuality?: number; // 1-5
  energyLevel?: number; // 1-5
  stressLevel?: number; // 1-5
  physicalLimitation?: string;
  notes?: string;
}

/** Free-text "no limitation" answers the founder (or a testing session)
 * might type into the optional physical-limitation field instead of
 * leaving it blank. Every reader of `physicalLimitation` should go through
 * `normalizePhysicalLimitation` below rather than testing truthiness
 * directly, otherwise a literal "nenhuma" reads as a reported limitation
 * and produces a self-contradicting sentence like "Reportaste uma
 * limitação física hoje (nenhuma)" (seen live in Histórico) plus an
 * incorrectly triggered "mobility instead of training" decision. */
const NO_LIMITATION_PHRASES = new Set([
  "nenhuma",
  "nenhum",
  "nao",
  "não",
  "n/a",
  "na",
  "sem",
  "sem limitação",
  "sem limitacao",
  "none",
  "no",
  "-",
]);

/** Returns the reported limitation text, or `undefined` if it's empty or
 * one of the common ways of saying "no limitation" (see
 * NO_LIMITATION_PHRASES). Use this instead of a raw truthiness check
 * anywhere `physicalLimitation` gates a rule or the operating-state
 * derivation. */
export function normalizePhysicalLimitation(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (NO_LIMITATION_PHRASES.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export interface DecisionRecord {
  date: string; // "YYYY-MM-DD"
  domain: DecisionDomain;
  status: DecisionStatus;
}

/**
 * Slim pantry snapshot for meal-recommendation rules (Milestone 11C) —
 * mirrors lib/coach/pantry-context.ts's PantrySummaryItem shape but is
 * defined independently here so the decision engine stays free of a
 * dependency on the Coach module. Ordered soonest-expiring first by the
 * caller (context-builder.ts / the API route), same as the Coach's
 * pantry summary — rules.ts relies on that ordering rather than
 * re-sorting, since it must stay pure/synchronous.
 */
export interface PantryItemSummary {
  name: string;
  quantity: number;
  unit: string;
  portable: boolean;
  expiresOn: string | null;
}

export interface DailyContext {
  date: string; // "YYYY-MM-DD"
  timezone: string;
  /**
   * ISO-like local wall-clock instant, e.g. "2026-07-29T13:15:00". Callers
   * (context-builder.ts) are responsible for supplying this already
   * adjusted to `profile.timezone` — rules.ts treats it as plain local time
   * (no further timezone conversion) so it stays a pure, synchronously
   * testable function of its inputs.
   */
  now: string;
  profile: UserProfile;
  calendarEvents: CalendarEvent[]; // empty until Milestone 3 (Google Calendar)
  freeWindows: FreeWindow[]; // empty until Milestone 3
  recentDecisions: DecisionRecord[]; // last 7 days, excluding today
  userCheckIn?: DailyCheckIn;
  /** Empty until Milestone 11C — degrades gracefully to the pre-11C generic dinner rules. */
  pantryItems: PantryItemSummary[];
  /**
   * Milestone 14: rule ids the founder has explicitly muted
   * (lib/decision-engine/queries.ts's listMutedRuleIds, /settings/memory) —
   * generateCandidates (rules.ts) filters these out before scoring even
   * runs. The founder's own editable memory always wins over any learned
   * pattern; muting is absolute, not a soft down-weight.
   */
  mutedRuleIds?: string[];
  /**
   * Milestone 14: a bounded, per-rule score adjustment derived from
   * historical outcomes (lib/decision-engine/patterns.ts), only populated
   * for rules that have crossed MIN_EVIDENCE_COUNT occurrences — see that
   * module's header for the "deterministic cold start, no opaque scoring"
   * acceptance criteria (docs/12_ROADMAP.md). Absent/empty means "behave
   * exactly like the pre-Milestone-14 engine".
   */
  ruleAdjustments?: Record<string, number>;
  /**
   * Milestone 12: the recipe name of today's planned dinner
   * (meal_plan_items, status 'planned'), when the Nutrition Toolkit's
   * weekly plan covers it. Undefined/null when no plan exists for today —
   * rules.ts falls back to the Milestone 11C pantry-based suggestion.
   * Deliberately takes priority over the ad-hoc pantry pick: a planned meal
   * is a stronger, already-decided commitment than "whatever's about to
   * expire" (PRODUCT_BACKLOG.md: "before dinner risk: use the meal already
   * assigned and available").
   */
  todaysDinnerPlanName?: string | null;
  /**
   * Task #117: the Training Toolkit session name planned for today
   * (training_plan_items joined with workout_sessions, status 'planned'),
   * when a training plan covers it — same rationale as
   * todaysDinnerPlanName above. Undefined/null when no training plan
   * exists for today; rules.ts's lunchTraining falls back to its
   * original generic "Treina entre as X e Y" phrasing unchanged.
   */
  todaysTrainingSessionName?: string | null;
}

export interface DecisionCandidate {
  ruleId: string;
  domain: DecisionDomain;
  recommendedStart?: string; // ISO 8601
  recommendedEnd?: string;
  recommendedAction: string; // plain-language fact, pre-phrasing
  baseTitle: string;
  baseReason: string;
  requiresFreeWindow: boolean;
  minWindowMinutes?: number;
  baseImpact: DecisionImpact;
  /**
   * Milestone 11D: the exact `pantry_items.name` this decision names (set by
   * decideDinnerEarly / avoidTakeawayCommitment via pickDinnerSuggestion,
   * Milestone 11C), carried through scoring/selection/persistence so that
   * completing the decision can auto-consume that pantry item without the
   * founder re-entering it manually. Undefined when no pantry item was named.
   */
  relatedPantryItem?: string;
  timingType: DecisionTimingType;
  triggerLabel?: string;
}

export interface ScoredCandidate extends DecisionCandidate {
  score: number; // combines impact/urgency/opportunity/adherence/confidence
  confidence: number; // 0-1, matches the decisions.confidence column
}

export interface GeneratedDecision {
  domain: DecisionDomain;
  title: string;
  reason: string;
  recommendedAction: string;
  recommendedStart?: string;
  recommendedEnd?: string;
  impact: DecisionImpact;
  confidence: number;
  source: DecisionSource;
  /** Milestone 11D — see DecisionCandidate.relatedPantryItem. */
  relatedPantryItem?: string;
  /** Milestone 14: carried through to decisions.rule_id so outcomes
   * (status/feedback) can be attributed back to the rule that produced
   * them — see lib/decision-engine/patterns.ts. */
  ruleId?: string;
  timingType: DecisionTimingType;
  triggerLabel?: string;
}
