# 06 — Decision Engine (deterministic core)

Module: `lib/decision-engine/` (not yet implemented — Milestone 4 in `REBUILD_MASTER_HANDOFF.md`; this document is the design to build against). Covers the deterministic layer — context assembly, rule evaluation, scoring, and selection. AI ranking/personalization is covered separately in `08_AI_ARCHITECTURE.md`. The rule catalog itself lives in `07_DECISION_CATALOG.md`. Persisted shapes (`decisions`, `decision_runs` tables) are defined in `10_DATABASE.md` — that migration is the source of truth for field names; this document's in-memory types feed into, but are not identical to, those DB rows.

## Design principle

Per `03_PRODUCT_PRINCIPLES.md`: deterministic rules decide *which* decisions are candidates; scoring and selection pick exactly three; AI only ranks close candidates, personalizes, and rewrites afterward (`08_AI_ARCHITECTURE.md`) — it never invents a domain, time, or action the rules didn't produce, never schedules inside a busy calendar window, and is never a single point of failure (the deterministic engine alone must produce a useful result if the AI provider fails).

## Module layout

```
lib/decision-engine/
  types.ts             — shared types
  context-builder.ts   — assembles DailyContext from profile + calendar + check-in + history
  rules.ts             — pure functions: DailyContext -> DecisionCandidate[] (see 07_DECISION_CATALOG.md)
  scorer.ts            — pure functions: score candidates (impact, urgency, opportunity, confidence, diversity)
  selector.ts          — picks exactly 3 non-overlapping, non-conflicting, domain-diverse decisions from scored candidates
  generator.ts         — orchestrates context-builder -> rules -> scorer -> selector -> AI refinement (see 08) -> Decision[]
  prompts.ts           — prompt templates + safety constraints for AI refinement (see 08)
  validation.ts        — schema validation for AI output before it's trusted (reject/fallback on invalid shape)
```

`selector.ts` and `validation.ts` are separate from `scorer.ts`/`generator.ts` deliberately: selection (choosing which 3 of N scored candidates ship, enforcing no-overlap/no-conflict/domain-diversity) is a distinct concern from scoring a single candidate, and validating untrusted AI output is a distinct concern from generating the prompt that produced it.

## types.ts

```ts
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
  start: string;
  end: string;
  durationMinutes: number;
}

export interface UserProfile {
  userId: string;
  preferredName: string;
  timezone: string;
  currentIdentity: string;
  desiredIdentity: string;
  primaryObjective: "rebuild-fitness" | "lose-weight" | "train-consistently" | "improve-nutrition" | "improve-sleep";
  preferredTrainingDays: string[]; // e.g. ["monday", "wednesday"]
  preferredTrainingTime: string; // "HH:MM"
  typicalDinnerTime: string;
  targetSleepTime: string;
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
  date: string;
  domain: DecisionDomain;
  status: DecisionStatus;
}

export interface DailyContext {
  date: string;
  timezone: string;
  profile: UserProfile;
  calendarEvents: CalendarEvent[];
  freeWindows: FreeWindow[];
  recentDecisions: DecisionRecord[]; // last 7 days
  userCheckIn?: DailyCheckIn;
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
}
```

`GeneratedDecision` is what `generator.ts` returns for the three selected candidates; the API route that calls it is responsible for writing a `decision_runs` row plus three `decisions` rows (see `10_DATABASE.md`), not the engine itself — the engine has no direct Supabase dependency beyond `context-builder.ts` reading input.

## context-builder.ts

`buildDailyContext({ userId, date }): Promise<DailyContext>` — orchestration only, no business rules:

1. Load `profile` from `profiles`.
2. Load today's `calendarEvents` (via the Google client, once Milestone 3 lands).
3. Compute `freeWindows` with a pure helper: `computeFreeWindows(events, dayStart, dayEnd, minGapMinutes)` — merges overlapping/adjacent busy intervals, returns gaps ≥ `minGapMinutes`. This is the one piece of calendar math that must be unit-tested directly with synthetic events; no Google API required for the test.
4. Load `recentDecisions` (last 7 days) from `decisions` for variety weighting and adherence scoring.
5. Load today's `userCheckIn` from `daily_check_ins` if present — the app must still work when it's absent.

## rules.ts

`generateCandidates(context: DailyContext): DecisionCandidate[]` assembles the pool from independently testable rule functions — see `07_DECISION_CATALOG.md` for the actual per-domain rule definitions and trigger conditions. Each rule function has the shape `(context: DailyContext) => DecisionCandidate[]` (a rule may produce zero, one, or more candidates) and is exported individually so it can be tested in isolation with synthetic fixtures — no Supabase, no Google API, no AI provider. Basic product functionality must not depend on an LLM at this stage.

## scorer.ts

`scoreCandidate(candidate, context): ScoredCandidate` — combines expected impact, urgency, available opportunity (does a matching free window exist right now), user preferences, historical adherence (from `recentDecisions`), confidence in the underlying data, calendar-conflict risk, recency (avoid repeating an domain proposed and skipped yesterday without acknowledging it), and cross-domain diversity pressure. Impact/urgency/opportunity are rule-driven inputs; the combined `score` and `confidence` are what `selector.ts` ranks on.

## selector.ts

`selectThree(scored: ScoredCandidate[], context: DailyContext): ScoredCandidate[]` — returns exactly three, enforcing:

- No two selected decisions overlap in time or conflict with a calendar event.
- The three do not all address the same underlying problem (domain diversity, unless too few domains have eligible candidates).
- The three represent the highest-value opportunities or risks, not just the first three generated.

## computeDecisionScore (in scorer.ts or a small shared helper)

Simple initial scoring, matching `REBUILD_MASTER_HANDOFF.md`:

- completed high-impact decision: +15 XP
- completed medium-impact decision: +10 XP
- completed low-impact decision: +5 XP
- accepted but not completed: +2 XP
- skipped: 0 XP (never negative — no-shame rule)

No streaks in this MVP.

All of `rules.ts`, `scorer.ts`, `selector.ts`, and `computeFreeWindows` are pure and unit-testable without any external dependency, following the same pattern as the existing `lib/decisions/*.test.ts` suite from the earlier local-only slice.
