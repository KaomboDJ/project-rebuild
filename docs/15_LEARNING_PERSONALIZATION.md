# 15 — Learning and Personalization (Milestone 14)

Per the founder's standing full-roadmap authorization (`docs/12_ROADMAP.md`). Scope: outcome logging, an interpretable pattern engine, personalized intervention selection, and user-visible/editable memory — explicitly *not* a machine-learning model (`CLAUDE.md`'s "do not build yet": "Machine-learning prediction models before enough real behavioural data exists").

## Acceptance criteria (restated from `docs/12_ROADMAP.md`)

1. **Deterministic cold start** — a founder with no decision history behaves identically to the pre-Milestone-14 engine. No rule gets an adjustment until it has evidence.
2. **Minimum evidence thresholds** — `MIN_EVIDENCE_COUNT = 5` proposals of a given rule before that rule's pattern is trusted enough to affect anything.
3. **No opaque scoring** — every adjustment is a plain, capped, human-computable formula (`lib/decision-engine/patterns.ts`), never a trained weight, and is exposed to the founder verbatim at `/settings/memory`.

## What was built

**Outcome logging.** `decisions.rule_id` (new nullable column, migration `202607300009`) is the missing join key: every generated decision already carried `status` (proposed/accepted/edited/completed/skipped) and could receive `decision_feedback.useful`, but neither could be attributed back to the specific rule that produced it, only its domain. `lib/decision-engine/types.ts`'s `DecisionCandidate.ruleId` / `GeneratedDecision.ruleId` now flow through `generator.ts` and `validation.ts` (the AI-refinement layer re-attaches the *original* rule's id from the deterministic candidate — it is never trusted from the AI's JSON output, since it's the attribution key) and are persisted by `lib/decision-engine/run.ts`'s `insertRow`. Pre-Milestone-14 rows stay `rule_id: null` and are simply excluded from pattern computation — never backfilled with a guess.

**Interpretable pattern engine.** `lib/decision-engine/patterns.ts` is pure and synchronous: `summarizeRulePatterns` groups decision/feedback rows by `ruleId`; `computeRuleInsight` turns one rule's raw counts into `completionRate`, `usefulnessRate` (falling back to completion rate when the founder never used the explicit feedback buttons), `hasEnoughEvidence`, and `personalizationAdjustment` — a value in `[-2, +2]` computed as `(signal - 0.5) * 2 * MAX_PERSONALIZATION_ADJUSTMENT`, clamped, and forced to `0` below the evidence threshold. `describeRuleInsight` renders the same insight as a short Portuguese sentence for the founder, never phrased as a diagnosis.

Nothing computed here is persisted — recomputing from `decisions` + `decision_feedback` on every read is cheap for a single founder's history, so there is no derived-data cache-invalidation problem to solve.

**Personalized intervention selection.** `lib/decision-engine/scorer.ts`'s `personalizationOf` adds `context.ruleAdjustments?.[candidate.ruleId] ?? 0` as one more additive term in `scoreCandidate` — on the same ~0-40+ scale as the existing impact/urgency/opportunity/adherence/confidence terms, small enough to nudge ranking among close candidates, never enough to override a genuinely higher-impact one.

**User-visible/editable memory.** Two mechanisms, deliberately distinct:
- `muted_rules` (new table) — the founder's own absolute opt-out of a specific rule ever being suggested again. `lib/decision-engine/rules.ts`'s `generateCandidates` filters these out *before scoring runs*, not as a soft down-weight. Muting always wins over any learned pattern.
- `founder_notes` (new table) — free-text notes the founder writes themselves, optionally scoped to a `rule_id` or general (`rule_id IS NULL`). General notes are folded into the Coach's system prompt (`lib/ai/provider.ts`'s `CoachContext.founderNotes`, populated by `lib/decision-engine/queries.ts`'s `listGeneralFounderNotes`, capped at the 10 most recent) as a standing preference the Coach should respect, not react to.

Both are exposed at `/settings/memory` (`components/settings/MemoryManager.tsx`), backed by `app/api/personalization/insights`, `.../mute`, and `.../notes[/[id]]`.

## Files

- `supabase/migrations/202607300009_learning_personalization.sql` — additive only: `decisions.rule_id`, `muted_rules`, `founder_notes`, RLS, grants.
- `lib/decision-engine/patterns.ts` (+ `patterns.test.ts`) — the pattern engine described above.
- `lib/decision-engine/rule-catalog.ts` — human-readable Portuguese labels per `ruleId`, used only by the settings UI/API (kept separate from `rules.ts` so that module stays free of any UI-facing concern).
- `lib/decision-engine/queries.ts` — server-only reads/writes: `getRuleInsights`, `getRuleAdjustments`, `listMutedRuleIds`, `muteRule`, `unmuteRule`, `listFounderNotes`, `listGeneralFounderNotes`, `createFounderNote`, `updateFounderNote`, `deleteFounderNote`.
- `lib/decision-engine/run.ts` — now fetches `mutedRuleIds`/`ruleAdjustments` before `buildDailyContext` and persists `rule_id` on every inserted decision; both fetches degrade to `[]`/`{}` on any failure so a personalization-layer error can never block the core three-decisions-a-day loop.
- `lib/decision-engine/{types,context-builder,rules,scorer,generator,validation}.ts` — threaded `ruleId`/`mutedRuleIds`/`ruleAdjustments` through the existing pipeline, as described above.
- `app/api/personalization/insights/route.ts`, `.../mute/route.ts`, `.../notes/route.ts`, `.../notes/[id]/route.ts` — the settings-page API surface.
- `components/settings/MemoryManager.tsx`, `app/(app)/settings/memory/page.tsx` — the UI; linked from `app/(app)/settings/page.tsx`.
- `lib/ai/provider.ts`, `app/api/coach/route.ts` — `CoachContext.founderNotes` wired into the system prompt.

## Explicitly not built

Any form of trained/learned model (embeddings, gradient-based weights, clustering). Any insight or adjustment not directly traceable to a plain formula over the founder's own rows. Cross-founder learning (this is a single-founder MVP; nothing here aggregates across users). Automatic muting (the founder must mute explicitly — a bad pattern only ever gets a small downward nudge, never a silent removal).
