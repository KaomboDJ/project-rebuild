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

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;
  isAllDay: boolean;
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
}
