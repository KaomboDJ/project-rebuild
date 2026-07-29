# Implementation Status

Living status tracker. Check this before assuming what already exists — `docs/` design files describe target architecture, not necessarily what's built yet. Update this file as milestones progress.

Last updated: 2026-07-29.

## Deployment

- **GitHub**: `https://github.com/KaomboDJ/project-rebuild.git`, branch `main`, latest published commit `7648e4e` ("Add Milestone 4: deterministic decision engine + AI refinement"). Milestone 2 work (onboarding → Supabase, below) is a fresh working-tree change on top of this, **not yet committed**.
- **Vercel**: production is live at `https://project-rebuild-chi.vercel.app`, auto-deploying pushes to `main`. Confirmed serving commit `7648e4e` live — `/today` renders the real Decision Engine check-in form for the founder's own session.
- **Supabase**: project `project-rebuild` (ref `ghogleattdmdragyrwof`, region Europe) is live. The full migration (`supabase/migrations/202607290001_foundation.sql`) has been applied and verified in the Table Editor — all 6 tables exist with RLS, and `calendar_connections` correctly has no public API exposure. Auth redirect URLs configured for both `localhost:3000` and the production domain.
- **Anthropic**: credentials exist locally (`.env.local`) and in Vercel. Never printed, committed, or logged.

## No remaining external-credential gaps for Milestones 1, 2, or 4

Supabase is live; `TOKEN_ENCRYPTION_KEY` is generated and set (local + Vercel). The only remaining gap is:

- **Google Cloud OAuth client** — not yet created. Blocks Milestone 3 (Google Calendar) entirely (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`).

## Milestone 1 — Foundation: Done, committed, pushed, deployed

Auth (Supabase magic-link), schema + RLS, app shell, route protection, env validation, lint/format/type-check config. See commit `2ab9b78`. `/today`, `/history`, `/settings` exist behind auth; `/history` and `/settings` remain minimal placeholders.

## Milestone 4 — Deterministic Decision Engine + AI refinement: Done, committed, pushed, deployed

Built ahead of Milestones 2 (onboarding→Supabase) and 3 (Google Calendar) per explicit founder direction — the engine works today using the daily check-in as its primary signal, with calendar-dependent rules already written and unit-tested but dormant (returning no candidates) until Milestone 3 supplies real `calendarEvents`.

| Item | Status | Notes |
|---|---|---|
| `lib/decision-engine/types.ts` | Done | Matches docs/06, plus a `now` field on `DailyContext` for deterministic time-of-day rules. |
| `lib/decision-engine/context-builder.ts` | Done | `buildDailyContext()` reads `profiles`/`daily_check_ins`/`decisions` via the user's own RLS-scoped session client — no service-role client needed. Falls back to a hardcoded founder-sourced default profile when no `profiles` row exists (now only relevant before a user completes Milestone 2's onboarding). `computeFreeWindows()` is pure and fully unit-tested. |
| `lib/decision-engine/rules.ts` | Done | Full 14-rule catalog from docs/07. 9 rules work today from check-in + profile + time-of-day alone (lunch/reduced training, mobility, prep equipment, decide dinner early, avoid takeaway, shutdown routine, protect sleep, short walk). 5 rules genuinely need calendar data (defrost ingredients, tomorrow's lunch, prepare next day, protect free window, move low-priority work) and correctly return `[]` until Milestone 3. |
| `lib/decision-engine/scorer.ts` | Done | Impact/urgency/opportunity/adherence/confidence scoring, plus `computeDecisionScore` (XP: 15/10/5 completed high/medium/low, +2 accepted/edited, 0 skipped — never negative). |
| `lib/decision-engine/selector.ts` | Done | Exactly 3 (or fewer if the pool genuinely has fewer), no time/calendar conflicts, domain diversity preferred but not forced when too few domains have candidates. |
| `lib/decision-engine/generator.ts` + `prompts.ts` + `validation.ts` | Done | AI refinement reuses the `lib/ai/provider.ts` adapter pattern (`ANTHROPIC_API_KEY` already configured, so this is live, not just scaffolded). Zod-validated: AI may reword/reorder, may not invent a domain, change impact, or move a scheduled time. Configurable timeout, safe fallback to rule output on any failure. |
| Tests | Done | `rules.test.ts`, `scorer.test.ts`, `selector.test.ts`, `context-builder.test.ts`, `generator.test.ts`, `validation.test.ts` — all synthetic fixtures, no network, no Supabase. **Not yet run** — see blocker below. |
| `app/api/decisions/generate/route.ts` | Done | Authenticated POST: builds context, runs the engine, upserts one `decision_runs` row + exactly 3 `decisions` rows (regeneration replaces the previous run's decisions rather than accumulating). |
| `app/api/decisions/[id]/route.ts` | Done | Authenticated PATCH: accept/complete/skip/edit a single decision, RLS-scoped + explicit `user_id` check. |
| `/today` UI | Done | Rewritten as a Server Component (`app/(app)/today/page.tsx`) fetching real Supabase data, rendering the new client components `DecisionDay`/`DailyCheckInForm`/`DecisionEngineCard`/`DecisionEngineScore`. **Replaces** the old localStorage-based `TodayExperience` bridge — that file (and the rest of `lib/decisions/*`) is now unused but left in place, not deleted. |
| Check-in persistence | Done | New check-in form writes directly to `daily_check_ins` via the browser Supabase client (RLS), matching the DB schema (`sleep_quality`/`energy_level`/`stress_level`/`physical_limitation`/`notes`) — replaces the old localStorage `CheckIn` component for the new flow. |

Validated via lint, typecheck, 102/102 tests, and a production build in an isolated sandbox copy of `node_modules` (see commit `7648e4e`). Two real bugs surfaced and were fixed during that pass: two `tsc` errors from untyped Supabase update/`Json` payloads, and a missing `server-only` dependency (added, plus a Vitest alias so tests don't hit its throwing branch — see `test/server-only-stub.ts`).

## Milestone 2 — Onboarding → Supabase persistence: Built, not yet committed

Replaces the old localStorage-only onboarding with a real `profiles` row, closing the gap noted above (the engine no longer needs to fall back to `DEFAULT_PROFILE` once a founder completes this form). The `profiles` table, RLS policies, and grants already existed from Milestone 1's migration — this is purely an application-layer change, no new migration required.

| Item | Status | Notes |
|---|---|---|
| `lib/profile/onboarding.ts` | Done | Pure, unit-tested: field list, primary-objective/weekday options, and `validateOnboardingDraft`/`isOnboardingValid`, mirroring the DB's `HH:MM` check constraints so a bad submission fails client-side before ever reaching Supabase. Deliberately does not import `context-builder.ts` (server-only) — duplicates `DEFAULT_PROFILE`'s literal values as sensible pre-filled defaults instead. |
| `components/OnboardingForm.tsx` | Rewritten | Was a free-text, localStorage-backed form tied to the old `lib/decisions/types.ts` shape. Now a client component that upserts directly to `profiles` (RLS-scoped browser client, same pattern as `DailyCheckInForm.tsx`) with `onboarding_completed: true`, covering every field in docs/05_MVP_SPEC.md's `/onboarding` route description (preferred name, timezone, current/desired identity, objective, training days, training/dinner/sleep times, constraints, tone). |
| `app/onboarding/page.tsx` | Rewritten | Server Component: redirects unauthenticated users to `/`, fetches any existing `profiles` row (pre-fills the form if one exists), redirects already-onboarded users straight to `/today` instead of re-showing the form. |
| `app/(app)/layout.tsx` | Updated | Now also checks `profiles.onboarding_completed` and redirects to `/onboarding` if missing/false — every route under `/today`, `/history`, `/settings` requires a completed profile first. `/onboarding` itself lives outside this route group so it isn't caught in its own redirect. |
| Tests | Done | `lib/profile/onboarding.test.ts` — required-field checks, invalid objective, empty training days, `HH:MM` boundary/invalid cases. Pure, synchronous, no network. |

`working_hours` is intentionally left at its DB default (`09:00`–`18:00`) — not part of the onboarding spec; would belong on `/settings` if it needs to become user-editable later.

Validated the same way as Milestone 4 (isolated sandbox copy, fresh `node_modules`): lint clean, typecheck clean, 114/114 tests (12 new), build succeeds. `/onboarding` and `/today` are both server-rendered on demand (`ƒ`), as expected given the auth + profile checks on every request.

## Milestones 3, 5–8

Not started. Milestone 3 (Google Calendar) unlocks the 5 dormant calendar-dependent rules already written and tested, and is blocked on a Google Cloud OAuth client (see the external-credential gap above). See `12_ROADMAP.md` for full ordering.
