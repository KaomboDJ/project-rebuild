# Implementation Status

Living status tracker. Check this before assuming what already exists — `docs/` design files describe target architecture, not necessarily what's built yet. Update this file as milestones progress.

Last updated: 2026-07-29.

## Deployment

- **GitHub**: `https://github.com/KaomboDJ/project-rebuild.git`, branch `main`, latest published commit `2ab9b78` ("Add Milestone 1 foundation: Supabase auth, schema, app shell"). Milestone 4 work (Decision Engine, below) is a fresh working-tree change on top of this, **not yet committed**.
- **Vercel**: production is live at `https://project-rebuild-chi.vercel.app`, auto-deploying pushes to `main`. Currently serving commit `2ab9b78` — the real Supabase-backed sign-in form, confirmed working live.
- **Supabase**: project `project-rebuild` (ref `ghogleattdmdragyrwof`, region Europe) is live. The full migration (`supabase/migrations/202607290001_foundation.sql`) has been applied and verified in the Table Editor — all 6 tables exist with RLS, and `calendar_connections` correctly has no public API exposure. Auth redirect URLs configured for both `localhost:3000` and the production domain.
- **Anthropic**: credentials exist locally (`.env.local`) and in Vercel. Never printed, committed, or logged.

## No remaining external-credential gaps for Milestones 1 or 4

Supabase is live; `TOKEN_ENCRYPTION_KEY` is generated and set (local + Vercel). The only remaining gap is:

- **Google Cloud OAuth client** — not yet created. Blocks Milestone 3 (Google Calendar) entirely (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`).

## Milestone 1 — Foundation: Done, committed, pushed, deployed

Auth (Supabase magic-link), schema + RLS, app shell, route protection, env validation, lint/format/type-check config. See commit `2ab9b78`. `/today`, `/history`, `/settings` exist behind auth; `/history` and `/settings` remain minimal placeholders.

## Milestone 4 — Deterministic Decision Engine + AI refinement: Built, not yet committed

Built ahead of Milestones 2 (onboarding→Supabase) and 3 (Google Calendar) per explicit founder direction — the engine works today using the daily check-in as its primary signal, with calendar-dependent rules already written and unit-tested but dormant (returning no candidates) until Milestone 3 supplies real `calendarEvents`.

| Item | Status | Notes |
|---|---|---|
| `lib/decision-engine/types.ts` | Done | Matches docs/06, plus a `now` field on `DailyContext` for deterministic time-of-day rules. |
| `lib/decision-engine/context-builder.ts` | Done | `buildDailyContext()` reads `profiles`/`daily_check_ins`/`decisions` via the user's own RLS-scoped session client — no service-role client needed. Falls back to a hardcoded founder-sourced default profile when no `profiles` row exists yet (onboarding isn't Supabase-backed yet — see gap below). `computeFreeWindows()` is pure and fully unit-tested. |
| `lib/decision-engine/rules.ts` | Done | Full 14-rule catalog from docs/07. 9 rules work today from check-in + profile + time-of-day alone (lunch/reduced training, mobility, prep equipment, decide dinner early, avoid takeaway, shutdown routine, protect sleep, short walk). 5 rules genuinely need calendar data (defrost ingredients, tomorrow's lunch, prepare next day, protect free window, move low-priority work) and correctly return `[]` until Milestone 3. |
| `lib/decision-engine/scorer.ts` | Done | Impact/urgency/opportunity/adherence/confidence scoring, plus `computeDecisionScore` (XP: 15/10/5 completed high/medium/low, +2 accepted/edited, 0 skipped — never negative). |
| `lib/decision-engine/selector.ts` | Done | Exactly 3 (or fewer if the pool genuinely has fewer), no time/calendar conflicts, domain diversity preferred but not forced when too few domains have candidates. |
| `lib/decision-engine/generator.ts` + `prompts.ts` + `validation.ts` | Done | AI refinement reuses the `lib/ai/provider.ts` adapter pattern (`ANTHROPIC_API_KEY` already configured, so this is live, not just scaffolded). Zod-validated: AI may reword/reorder, may not invent a domain, change impact, or move a scheduled time. Configurable timeout, safe fallback to rule output on any failure. |
| Tests | Done | `rules.test.ts`, `scorer.test.ts`, `selector.test.ts`, `context-builder.test.ts`, `generator.test.ts`, `validation.test.ts` — all synthetic fixtures, no network, no Supabase. **Not yet run** — see blocker below. |
| `app/api/decisions/generate/route.ts` | Done | Authenticated POST: builds context, runs the engine, upserts one `decision_runs` row + exactly 3 `decisions` rows (regeneration replaces the previous run's decisions rather than accumulating). |
| `app/api/decisions/[id]/route.ts` | Done | Authenticated PATCH: accept/complete/skip/edit a single decision, RLS-scoped + explicit `user_id` check. |
| `/today` UI | Done | Rewritten as a Server Component (`app/(app)/today/page.tsx`) fetching real Supabase data, rendering the new client components `DecisionDay`/`DailyCheckInForm`/`DecisionEngineCard`/`DecisionEngineScore`. **Replaces** the old localStorage-based `TodayExperience` bridge — that file (and the rest of `lib/decisions/*`) is now unused but left in place, not deleted. |
| Check-in persistence | Done | New check-in form writes directly to `daily_check_ins` via the browser Supabase client (RLS), matching the DB schema (`sleep_quality`/`energy_level`/`stress_level`/`physical_limitation`/`notes`) — replaces the old localStorage `CheckIn` component for the new flow. |

### Known gap: onboarding is still local-only

Per explicit founder direction, Milestone 2 (onboarding → Supabase `profiles` persistence) was **deferred** in favor of building the Decision Engine first. Consequence: there is no real `profiles` row for the founder yet, so `context-builder.ts` runs on the hardcoded `DEFAULT_PROFILE` fallback (sourced from `FOUNDER_CONTEXT.md`/`PROJECT_REBUILD_STATE.md`) rather than real onboarding answers. The engine is fully functional either way, but personalization (preferred training days/times, tone, identity) won't reflect reality until Milestone 2 lands. `/onboarding` still exists but is unchanged (localStorage, not wired to `/today` anymore).

### Validation: done (run in an isolated sandbox copy, not the real `node_modules`)

`npm run lint`, `npm run typecheck`, `npm test` (102/102), and `npm run build` all pass. To avoid corrupting the founder's Windows-native `node_modules`, this was validated by copying the repo (excluding `node_modules`/`.git`/`.next`) into a disposable sandbox directory, running a fresh `npm install` there, and validating against that copy only. Two real issues surfaced and were fixed in the actual repo:

- `app/api/decisions/[id]/route.ts` and `app/api/decisions/generate/route.ts` had two `tsc` errors from untyped `Record<string, unknown>` values passed to Supabase's typed `.update()`/`Json` columns — fixed with a proper `Database[...]["Update"]` type and a `JSON.parse(JSON.stringify(...))` round-trip for the `Json` snapshot column.
- `server-only` (imported by `context-builder.ts`, `generator.ts`, and three pre-existing files) was never listed in `package.json` and isn't a no-op under Vitest's plain Node resolution — it only resolves to a no-op under Next's bundler-set `react-server` condition. Added `server-only` as a real dependency, plus a `test/server-only-stub.ts` + `vitest.config.ts` alias so tests don't hit its throwing branch. **Run `npm install` on the dev machine before the next `npm test`/`npm run build`** to pick up the new dependency.

Recommended commit message:

```
Add Milestone 4: deterministic decision engine + AI refinement

Full rule catalog (docs/07) as pure, unit-tested functions; scorer +
selector enforcing exactly-3/no-conflict/domain-diversity; generator.ts
reuses the lib/ai/provider.ts adapter pattern for AI refinement with
zod-validated fallback. New API routes persist decisions to Supabase
(decision_runs + decisions, RLS-scoped, no service-role needed). /today
rewritten as a Server Component on real data, replacing the localStorage
bridge. Onboarding (Milestone 2) and Google Calendar (Milestone 3)
intentionally deferred — profile falls back to founder defaults until
Milestone 2 lands.

Adds server-only as a real dependency (previously implicitly relied on,
untested) with a Vitest alias so tests don't hit its throwing branch.
Fixes two tsc errors from untyped Supabase update/Json payloads. Verified
via lint, typecheck, 102/102 tests, and a production build in an isolated
sandbox copy of node_modules.
```

## Milestones 2, 3, 5–8

Not started. Milestone 2 (onboarding → Supabase) is the natural next step now that the engine expects a real `profiles` row. Milestone 3 (Google Calendar) unlocks the 5 dormant calendar-dependent rules already written and tested. See `12_ROADMAP.md` for full ordering.
