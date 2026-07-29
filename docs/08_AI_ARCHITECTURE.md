# 08 — AI Architecture

Covers `lib/decision-engine/generator.ts`, `prompts.ts`, and `validation.ts` (Milestone 7 in `REBUILD_MASTER_HANDOFF.md`) — the AI refinement stage that runs after the deterministic core (`06_DECISION_ENGINE.md`, `07_DECISION_CATALOG.md`) has already selected exactly three candidates.

## The AI's role: rank, personalize, rewrite — never invent

Per `REBUILD_MASTER_HANDOFF.md` §13/§22, the AI provider:

**May:**
- Rank close candidates (fine-grained re-ordering within what `selector.ts` already chose).
- Personalize wording to the user's tone and identity.
- Shorten explanations.
- Adapt tone.
- Identify relevant historical patterns to reference in the `reason` text.

**Must not:**
- Invent calendar events.
- Invent user data.
- Schedule inside a busy calendar window.
- Return unvalidated output (all output goes through `validation.ts` before it's trusted).
- Become a single point of failure — if the AI provider fails or returns invalid output, the deterministic engine's plain-text candidates ship as-is (`source: "rule"`).

This mirrors and extends the adapter pattern already established in `lib/ai/provider.ts` for the (separate, still-active) Decision Coach — reuse the mock/live fallback shape, don't reinvent it.

## Provider interface

```ts
export interface AIProvider {
  refineDecisions(
    context: DailyContext,
    candidates: GeneratedDecision[] // the 3 already selected by selector.ts, source: "rule"
  ): Promise<GeneratedDecision[]>; // same 3, possibly reordered/reworded, source becomes "ai" or "hybrid"
}
```

The product layer (`generator.ts`) must not be tightly coupled to Anthropic or any other vendor — `getAIProvider()` selects an implementation the same way `lib/ai/provider.ts::getCoachProvider()` already does, gated on an API key being present.

## Requirements

- **Structured output** — the provider must return JSON matching `GeneratedDecision[]`, not free text to be parsed loosely.
- **Schema validation** (`validation.ts`) — validate the AI's JSON against the expected shape before using it; on failure, fall back to the rule-generated candidates unchanged.
- **Timeout handling** — bound how long `generator.ts` waits; on timeout, fall back.
- **Safe retries where appropriate** — at most one retry on transient failure, not an unbounded loop.
- **Deterministic fallback** — always available, always the plain rule output; this is not optional.
- **No fabricated context** — the prompt sends only the three already-selected candidates plus the minimal context needed to phrase them (see "privacy-safe logging" below), never raw calendar event titles/descriptions beyond what's necessary.
- **Prompt versioning** — `prompts.ts` exports a version string alongside the template; `decision_runs.engine_version` and/or a per-decision marker should reflect which prompt version produced AI-refined output, so behavior changes are auditable.

## Safety constraints (prompt-level, non-negotiable)

Carried forward from `lib/ai/provider.ts`'s existing `SAFETY_RULES` and `CLAUDE.md`'s "Coaching safety" section:

- No diagnosis, no promised reversal of prediabetes/insulin resistance, no medication/supplement prescriptions, no unsafe fasting, dehydration, punishment, or compensatory exercise.
- Respect reported constraints (interrupted sleep, kidney-stone history); defer to clinicians for medical judgment calls.
- Tone from `profile.interventionTone`; language matches onboarding language (default Portuguese from Portugal).
- Calm, concise, actionable — no long motivational speeches (`REBUILD_MASTER_HANDOFF.md` §6).

## Privacy-safe logging / data sent to the provider

Per `REBUILD_MASTER_HANDOFF.md` §19: prefer sending normalized context (event time, busy/free, duration, optional category) over full private event titles/descriptions unless clearly necessary for a specific candidate's reasoning. Never log token values. Never log full calendar payloads at info level.

## Data flow

```
profile + calendar + check-in + recent history
        │
        ▼
  context-builder.ts        →  DailyContext
        │
        ▼
      rules.ts                →  DecisionCandidate[]
        │
        ▼
      scorer.ts + selector.ts  →  exactly 3, source: "rule"
        │
        ▼
  generator.ts + prompts.ts + AIProvider + validation.ts
        │  (on success: reordered/reworded, source: "ai"|"hybrid")
        │  (on failure/invalid output: unchanged, source: "rule")
        ▼
   persisted as one decision_runs row + 3 decisions rows, rendered on /today
```

## Testing

`generator.ts` is tested with a mock `AIProvider` to verify orchestration and the fallback path (including a provider that throws, times out, and returns invalid JSON) without hitting the Anthropic API. `rules.ts`/`scorer.ts`/`selector.ts` tests (see `06_DECISION_ENGINE.md`) never involve this layer at all — that's the point of the split.
