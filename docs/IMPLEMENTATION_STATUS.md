# Implementation Status

Living status tracker. Check this before assuming what already exists — `docs/` design files describe target architecture, not necessarily what's built yet. Update this file as milestones progress.

Last updated: 2026-07-30.

## Deployment

- **GitHub**: `https://github.com/KaomboDJ/project-rebuild.git`, branch `main`, latest published commit `9ef7c20` ("Add Milestone 3: Google Calendar integration").
- **Vercel**: production is live at `https://project-rebuild-chi.vercel.app`, auto-deploying pushes to `main`. Confirmed deployment of commit `9ef7c20` reached "Ready" in the Vercel dashboard (~50s build).
- **Supabase**: project `project-rebuild` (ref `ghogleattdmdragyrwof`, region Europe) is live. The full migration (`supabase/migrations/202607290001_foundation.sql`) has been applied and verified in the Table Editor — all 6 tables exist with RLS, and `calendar_connections` correctly has no public API exposure. Auth redirect URLs configured for both `localhost:3000` and the production domain.
- **Google Cloud**: project `project-rebuild` (ID `project-rebuild-503922`), OAuth consent screen (External, Testing, scope `calendar.events`, test user is the founder's own account) and a Web OAuth client both exist. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` are set locally and in Vercel (Production + Preview, with the correct redirect URI per environment).
- **Anthropic**: credentials exist locally (`.env.local`) and in Vercel. Never printed, committed, or logged.

## No remaining external-credential gaps

Supabase, Google Cloud OAuth, and `TOKEN_ENCRYPTION_KEY` are all live (local + Vercel). Nothing currently blocks Milestones 1–4 on external setup.

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

## Milestone 2 — Onboarding → Supabase persistence: Done, committed, pushed, deployed

Replaces the old localStorage-only onboarding with a real `profiles` row, closing the gap noted above (the engine no longer needs to fall back to `DEFAULT_PROFILE` once a founder completes this form). The `profiles` table, RLS policies, and grants already existed from Milestone 1's migration — this is purely an application-layer change, no new migration required.

| Item | Status | Notes |
|---|---|---|
| `lib/profile/onboarding.ts` | Done | Pure, unit-tested: field list, primary-objective/weekday options, and `validateOnboardingDraft`/`isOnboardingValid`, mirroring the DB's `HH:MM` check constraints so a bad submission fails client-side before ever reaching Supabase. Deliberately does not import `context-builder.ts` (server-only) — duplicates `DEFAULT_PROFILE`'s literal values as sensible pre-filled defaults instead. |
| `components/OnboardingForm.tsx` | Rewritten | Was a free-text, localStorage-backed form tied to the old `lib/decisions/types.ts` shape. Now a client component that upserts directly to `profiles` (RLS-scoped browser client, same pattern as `DailyCheckInForm.tsx`) with `onboarding_completed: true`, covering every field in docs/05_MVP_SPEC.md's `/onboarding` route description (preferred name, timezone, current/desired identity, objective, training days, training/dinner/sleep times, constraints, tone). |
| `app/onboarding/page.tsx` | Rewritten | Server Component: redirects unauthenticated users to `/`, fetches any existing `profiles` row (pre-fills the form if one exists), redirects already-onboarded users straight to `/today` instead of re-showing the form. |
| `app/(app)/layout.tsx` | Updated | Now also checks `profiles.onboarding_completed` and redirects to `/onboarding` if missing/false — every route under `/today`, `/history`, `/settings` requires a completed profile first. `/onboarding` itself lives outside this route group so it isn't caught in its own redirect. |
| Tests | Done | `lib/profile/onboarding.test.ts` — required-field checks, invalid objective, empty training days, `HH:MM` boundary/invalid cases. Pure, synchronous, no network. |

`working_hours` is intentionally left at its DB default (`09:00`–`18:00`) — not part of the onboarding spec; would belong on `/settings` if it needs to become user-editable later.

Validated the same way as Milestone 4 (isolated sandbox copy, fresh `node_modules`): lint clean, typecheck clean, 114/114 tests (12 new), build succeeds. `/onboarding` and `/today` are both server-rendered on demand (`ƒ`), as expected given the auth + profile checks on every request. Committed as `4f1db56`, pushed, and confirmed live on Vercel.

## Milestone 3 — Google Calendar integration: Done, committed, pushed, deployed

Google Cloud project, OAuth consent screen, and OAuth client were set up directly in Google Cloud Console (with the founder's explicit go-ahead at each step — new project, ToS acceptance). Application code wires the OAuth connect/callback/disconnect flow, encrypted token storage, calendar reads, and optional intervention-event creation into the existing Decision Engine and `/settings`.

| Item | Status | Notes |
|---|---|---|
| `lib/crypto/tokens.ts` | Done | AES-256-GCM encrypt/decrypt for `calendar_connections` tokens at rest, using Node's built-in `crypto` (no external dependency). Packed format is versioned (`v1:iv:authTag:ciphertext`) so the scheme can evolve later. |
| `lib/date/timezone.ts` | Done, tested | Converts a wall-clock local time to a UTC instant and computes a full local-day `[timeMin, timeMax)` range for Google's `events.list`. Deliberately separate from `lib/date/local.ts` (server-local time only) — this one is timezone-aware. 4 tests (Lisbon DST, UTC, America/New_York, full-day range). |
| `lib/google/oauth.ts` | Done | Dependency-free OAuth 2.0 client (`fetch` against Google's REST endpoints, not the `googleapis` SDK): `buildGoogleAuthUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `revokeGoogleToken`, `isGoogleCalendarConfigured`. Requests `access_type=offline` + `prompt=consent` so a refresh token is always issued. Scope is the minimum needed: `calendar.events`. |
| `lib/google/calendar.ts` | Done | `getValidAccessToken` (reads the encrypted connection, refreshes and persists a new access token if expired, returns `null` if never connected), `getCalendarEventsForDate` (queries Google, maps to the engine's `CalendarEvent` shape, fails safe to `[]`), `createInterventionEvent` (creates a calendar event for an accepted decision, tagged `extendedProperties.private.createdBy`), `saveCalendarConnection` / `disconnectCalendar` / `isCalendarConnected`. All admin-client-only, matching `calendar_connections`' service-role-only RLS. |
| `app/api/google/connect/route.ts` | Done | Authenticated GET: sets a short-lived CSRF state cookie, redirects to Google's consent screen. |
| `app/api/google/callback/route.ts` | Done | Authenticated GET: verifies the state cookie, exchanges the code, persists the encrypted connection, redirects to `/settings` with a status query param. |
| `app/(app)/settings/actions.ts` | Done | Server action `disconnectGoogleCalendar` — revokes with Google (best-effort) and deletes the local row regardless. |
| `app/(app)/settings/page.tsx` | Updated | Real Google Calendar section: connect link, connected/disconnected/denied/error/not-configured status messages, disconnect button. Replaces the old "will be wired up later" placeholder. |
| `app/api/calendar/create-intervention/route.ts` | Done | Authenticated POST: creates a calendar event for a specific accepted/edited decision that has a recommended time window, stores the returned Google event id on the `decisions` row. Returns `409` (not an error state in the UI) if the user hasn't connected a calendar — the decision loop never depends on this. |
| `components/DecisionEngineCard.tsx` | Updated | "Adicionar ao calendário" button appears once a decision is accepted/edited and has a time window; shows a quiet note once the event exists, and a specific message if the user isn't connected yet. |
| `app/api/decisions/generate/route.ts` | Updated | Now reads the profile's timezone, fetches today's calendar events via `getCalendarEventsForDate`, and passes them into `buildDailyContext` — the 5 dormant calendar-dependent rules from Milestone 4 become live for any user who has connected Google Calendar. Still generates decisions correctly with `calendarEvents: []` if not connected. |
| `.env.example` | Already covered | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`/`TOKEN_ENCRYPTION_KEY` were already documented from Milestone 3 prep — no change needed. |

Not yet done: `app/api/google/disconnect/route.ts` was planned but superseded by the `app/(app)/settings/actions.ts` server action instead (same effect, no extra client-side fetch/round-trip, consistent with the existing `signOut` pattern). A standalone `app/api/calendar/today/route.ts` was planned but skipped — nothing in the app currently needs calendar data outside the decision-generation flow, and an unused route is dead code.

**Known limitation carried over from Milestone 4, not introduced here**: `context-builder.ts`'s day-boundary math (`${date}T00:00:00` / `${date}T23:59:59`) is parsed as the server process's local time, not the founder's actual timezone — a pre-existing simplification. `getCalendarEventsForDate` itself queries Google with the *correct* timezone-aware range (`lib/date/timezone.ts`), so the calendar events returned are correct; the free-window math that consumes them inherits the existing ~offset-sized imprecision near midnight. Worth fixing if it causes a visible issue, not blocking for this milestone.

Validated in an isolated sandbox copy of `node_modules`: lint clean, typecheck clean, 118/118 tests (4 new), production build succeeds — every route, including the new `/api/google/*` and `/api/calendar/*` endpoints, traced correctly. Committed as `9ef7c20`, pushed, and confirmed "Ready" in the Vercel dashboard.

Still not exercised: the end-to-end OAuth consent flow (actually visiting `/api/google/connect` and granting access as the test user) hasn't been run live — that's a "grant OAuth/SSO permissions" action, so it should happen with the founder present rather than via unattended browser automation.

### Post-ship bugfix: `calendar_connections` was missing its `service_role` grant

The founder tried connecting live and got "Não foi possível ligar o Google Calendar" every time. Vercel runtime logs (`/api/google/callback`) showed the real cause: `Error: Failed to save calendar connection: permission denied for table calendar_connections` — a Postgres-level GRANT error, not an RLS rejection.

Root cause: `202607290001_foundation.sql` explicitly runs `grant select, insert, update, delete on table ... to authenticated;` for the other 5 tables, giving the RLS-scoped browser client its base privileges. `calendar_connections` correctly has no such grant to `anon`/`authenticated` (it's service-role only, per its own table comment) — but it also never got the equivalent grant to `service_role` itself. Unlike a default Supabase project, this database's default privileges don't automatically cover `service_role` on new tables, so the admin client (`lib/supabase/admin.ts`, the only thing that ever touches this table) had zero table-level access despite `service_role` correctly bypassing RLS.

Fix: `supabase/migrations/202607300001_calendar_connections_service_role_grant.sql` — `grant select, insert, update, delete on table public.calendar_connections to service_role;`. Applied directly via the Supabase SQL Editor and verified with `information_schema.role_table_grants` (service_role now shows SELECT/INSERT/UPDATE/DELETE). Migration file committed to the repo so `supabase db push`/fresh environments stay in sync with what's live.

The founder should retry connecting from `/settings` — this was the only blocker.

## Milestones 5–8

Not started. See `12_ROADMAP.md` for full ordering.
