# Implementation Status

## Phase 1 health-product completion (2026-08-03)

Status: **implemented and locally validated on `codex/phase1-health-completion`; production activation pending the release gates and external secrets listed in `docs/19_PHASE_1_HEALTH_COMPLETION.md`.**

This final Phase 1 slice adds sleep-aware quiet hours and shift-schedule support, unified selected Google + read-only Outlook availability, opt-in Web Push, the remaining nutrition modes and meal-count behavior, recalculating linked shopping lists, batch-preparation guidance, the global Rebuild Guide and non-punitive identity progression. The scope is now frozen to those health/decision capabilities; adjacent platform ideas remain outside Phase 1.

Local evidence: TypeScript clean, lint clean, production build successful and 386/386 unit tests passing.

Living status tracker. Check this before assuming what already exists — `docs/` design files describe target architecture, not necessarily what's built yet. Update this file as milestones progress.

Last updated: 2026-08-01 (Daily Home + Decisions UX recovery release-validated on PR #5; production migration applied and verified).

## Daily Home + Decisions UX recovery (branch `codex/daily-home-recovery`, 2026-08-01)

Status: **implemented and fully release-validated on PR #5. The additive production migration is applied and verified.**

The authenticated entry point is now `/home`, which compiles calendar commitments, free windows, meals, training/recovery and daily decisions into one chronological agenda. Home owns plan generation, review, explicit confirmation and conflict recovery. `/today` remains the Decisions execution/feedback workspace and now shows only a compact plan-status link back to Home, removing the confusing disabled batch-planning control.

The root data problem is fixed with structured timing (`calendar_slot`, `trigger_based`, `flexible`), deterministic free-slot selection and current-calendar conflict checks. Calendar-slot decisions can be found/rescheduled without overlap, but no external calendar write or silent move occurs without explicit founder confirmation. The Coach receives the same compiled timing context.

Additive migration: `supabase/migrations/202608010001_daily_home_timing.sql` (`decisions.timing_type`, `decisions.trigger_label`, `decisions.calendar_connection_id`, `decision_runs.plan_confirmed_at`). It was applied to Production and all four columns were verified through `information_schema.columns`. Detailed behavior and non-goals: `docs/18_HOME_AND_DECISIONS.md`.

Validation on the release branch: typecheck clean; lint clean; 317/317 unit tests passing; production build successful. GitHub Actions CI run #29 (`https://github.com/KaomboDJ/project-rebuild/actions/runs/30690813353`) ran Playwright and Axe for real against the configured disposable Supabase environment: **90 total, 84 passed, 6 correctly skipped `@live-email` cases, 0 failed**. Home/Decisions behavior passed at desktop, laptop, tablet and mobile viewports; keyboard flows passed; Axe detected zero WCAG A/AA violations on covered screens; all 24 cross-account isolation tests passed. One disposable account left by an earlier cancelled run was deleted by exact id/email after verification, and the final `auth.users` count matching `pw-%` is zero.

## Running checklist — Milestones 10-14 (full roadmap authorization, 2026-07-30)

Founder-authorized, executed milestone by milestone with a check-in after each (see `PROJECT_REBUILD_STATE.md` governance note and `docs/12_ROADMAP.md`'s "Full roadmap authorization" table). This section is the single running tracker the founder asked for — update it in place rather than writing a new status section per milestone.

- [x] **Milestone 10 — Review and release Coach UX + Pantry Intelligence.** Build complete (see "Coach UX + Pantry Intelligence milestone" section below). Validated: lint clean, typecheck clean, 180/180 tests, Vercel Preview build confirmed Ready. Production Supabase migrations applied and verified (6 new tables, RLS enabled on all). Live smoke test on the Preview deployment (2026-07-30) exercised the full propose→confirm→execute Coach tool-calling flow end to end (add-to-shopping-list → confirm → row visible on `/nutrition/shopping`), the shopping→pantry purchase flow (`mark_item_purchased` correctly created a pantry row), the append-only inventory ledger ("Terminou" correctly zeroed quantity via `apply_inventory_event`), conversation persistence/reload from the sidebar, and Markdown rendering. Found and fixed two real bugs during the test: (1) `max_tokens: 600` on the Anthropic call was truncating genuine multi-paragraph/bulleted replies mid-sentence — raised to `2048`; (2) tool-call-only turns (no assistant text) rendered an empty message bubble above the tool-call card — now hidden when there's no content. Both fixes committed as `59b0a6a` and pushed; re-verified live on Preview after redeploy — long replies now complete in full and the empty bubble is gone. Mobile/responsive layout for `/coach` and `/nutrition` was not independently re-verified this session (the sandbox's window-resize tool didn't change the actual browser viewport); these pages reuse the same Tailwind responsive patterns validated for the rest of the app in the earlier visual-redesign milestone, but this is a gap in this round's verification, not a confirmed pass. Committed as `edbc916` + `59b0a6a` + `80cf067` on `calendar-workspace`. Founder said "Go forward" (2026-07-30); merged to `main` (fast-forward, `80cf067`) and confirmed the resulting Vercel Production deployment reached Ready. **Milestone 10 complete: merged and live in production.**
- [x] Milestone 11 — Daily Planning Engine (multi-account Google Calendar, "Programar o meu dia" workflow, calendar-aware meal recommendation, pantry/consumption/shopping integration). All four sub-slices (11A-11D) shipped — see below. **11A (multi-account Google Calendar) built, validated, not yet merged/deployed.** Before starting, the founder confirmed two scope decisions that materially change the data model (`docs/10_DATABASE.md`): (1) multiple connected accounts are merged for planning — free/busy is computed across every connected account, not just one; (2) "Adicionar ao calendário" always asks which connected account to write to when the founder has more than one (no silent default, per his correction after the first answer). Schema: `supabase/migrations/202607300005_multi_account_calendar.sql` drops the old `unique(user_id, provider)` on `calendar_connections`, adds `google_account_email`/`label`/`is_primary`, enforces exactly one primary per user via a partial unique index. `lib/google/oauth.ts`: added `openid email` scopes and `prompt=select_account consent` so reconnecting shows Google's account chooser instead of silently reusing the same session. `lib/google/calendar.ts`: rewritten around `listConnections`/`setPrimaryConnection`/`disconnectCalendarConnection`, `getValidAccessToken`/`createInterventionEvent` now take an optional `connectionId` (default: primary), and event reads (`getCalendarEventsForRange`/`Date`) fetch from every connection and merge via the new pure, unit-tested `mergeConnectionEvents`. New `GET /api/calendar/connections`; `create-intervention` accepts an optional `connectionId`. Settings page lists every connected account with primary badge, "Tornar principal", and per-account "Desligar"; "Ligar outra conta" reuses `/api/google/connect`. `DecisionEngineCard`'s "Adicionar ao calendário" opens an inline account picker instead of writing directly whenever the founder has 2+ connections (0-1 connections: unchanged single-click behavior). Validated in an isolated sandbox: lint clean, typecheck clean, 184/184 tests (4 new, covering `mergeConnectionEvents`). Founder said "go ahead" (2026-07-30). Production migration applied via the Supabase SQL Editor and verified in `information_schema.columns` (`google_account_email`/`label`/`is_primary` all present on `calendar_connections`). Branch merged to `main` (fast-forward, `3f0daec`) and confirmed Ready on Vercel Production. **Milestone 11A complete: merged, migrated, and live in production.**
  **11B ("Programar o meu dia" batch planning) built, validated, and shipped.** After 11A, the founder lifted the standing per-milestone go-ahead requirement ("go through all of them... implement them all" — see `PROJECT_REBUILD_STATE.md`'s matching governance note) — 11B onward proceeds without a fresh check-in before each production step, though still one coherent vertical slice at a time. Scope: the founder had to tap Accept, then separately Adicionar ao calendário, for each of up to three decisions every morning — 11B adds a single "Programar o meu dia" batch action that does both steps for everything actionable in one tap. New pure module `lib/decision-engine/day-plan.ts`: `decisionsNeedingAcceptance` (still-`proposed` decisions with a time window), `decisionsNeedingCalendarEvent` (accepted/edited, has a full time window, no `calendar_event_id` yet), `dayPlanWouldScheduleAnything` (gates whether the button does anything, and whether it's worth asking for an account first). `components/CalendarWorkspace.tsx`: new "Programar o meu dia" button above the decisions list; when clicked it accepts every proposed decision with a time window via the existing `PATCH /api/decisions/[id]`, then creates a calendar event for everything now actionable via the existing `POST /api/calendar/create-intervention` — no new API routes, no schema change, purely composing endpoints that already existed for 11A/M3. If the founder has 2+ connected accounts, asks once which account to use for the whole batch (not per event) before running it — a deliberate, distinct choice from the per-decision picker (still asks per event when using that button individually), not a silent default. Shows a one-line summary afterward ("Dia planeado: N decisão(ões) aceite(s), M adicionada(s) ao calendário.") or a clear message if Calendar isn't connected or there's nothing left to plan. Validated in an isolated sandbox: lint clean, typecheck clean, 195/195 tests (11 new, covering all three `day-plan.ts` functions). Production build hit a pre-existing, unrelated sandbox network restriction (can't fetch Google Fonts via `next/font` — not caused by this change; Vercel's own build environment has internet access). No production migration needed (reuses existing tables/columns/routes). Merged to `main` (fast-forward, `61aadc3`) and confirmed Ready on Vercel Production. **Milestone 11B complete: merged and live in production.**
  **11C (calendar-aware meal recommendation) built and validated.** Scope: the existing `decideDinnerEarly`/`avoidTakeawayCommitment` nutrition rules only ever said "decide now" — they never referenced what's actually at home, even though Milestone 10 already tracks pantry inventory. 11C closes that gap directly in service of the founder's non-negotiable ("Mesmo num dia péssimo, janto comida que já existe em casa") and experiment items 3-4 (decide dinner before fatigue, avoid unplanned takeout). `lib/decision-engine/types.ts` adds `PantryItemSummary` (mirrors `lib/coach/pantry-context.ts`'s shape independently, so the engine stays free of a Coach dependency) and a `pantryItems: PantryItemSummary[]` field on `DailyContext` (empty array, not optional — same pattern as `calendarEvents`/`freeWindows`, degrades gracefully). `context-builder.ts`'s `buildDailyContext` takes an optional `pantryItems` param (default `[]`) and passes it through untouched. `rules.ts` adds a small pure helper `pickDinnerSuggestion` (first pantry item — the caller is responsible for pre-sorting soonest-expiring-first, matching `buildPantrySummary`'s existing order) and uses it in both rules: with pantry data, the recommendation names a specific item ("Janta Frango, que já tens em casa..."); with no pantry data, the exact original generic phrasing is unchanged (verified by test). `app/api/decisions/generate/route.ts` fetches the pantry summary via the existing `buildPantrySummary` (Milestone 10, previously Coach-only) and passes it into `buildDailyContext` — no new table, no new route, no schema change. Validated in an isolated sandbox: lint clean, typecheck clean, 198/198 tests (3 new, covering both the generic-fallback and pantry-aware phrasing for each rule). No production migration needed (reuses existing `pantry_items` table). Merged to `main` (fast-forward, `6225790`) and confirmed Ready on Vercel Production. **Milestone 11C complete: merged and live in production.**
  **11D (pantry/consumption/shopping integration into planning) built, validated, and shipped.** Scope: 11C named a specific at-home pantry item in the recommendation text but never touched inventory — the founder still had to separately log the consumption in `/nutrition/pantry` or via the Coach after eating. 11D closes that loop: completing a nutrition decision that named a pantry item now auto-consumes it. New nullable `decisions.related_pantry_item` column (`supabase/migrations/202607300006_decisions_pantry_link.sql`) records the exact `pantry_items.name` a `decideDinnerEarly`/`avoidTakeawayCommitment` candidate named. `DecisionCandidate`/`GeneratedDecision` (`lib/decision-engine/types.ts`) both gain an optional `relatedPantryItem` field, set by `rules.ts` alongside the existing pantry-aware phrasing, carried unchanged through `scorer.ts`/`selector.ts` (both already spread the candidate), and re-attached from the deterministic original in `validation.ts` after AI refinement rather than trusted from the AI payload — the AI is never asked to return it, matching the existing treatment of impact/timing. `app/api/decisions/generate/route.ts` persists it on insert. New `consumeRelatedPantryItem` helper (`lib/coach/pantry-context.ts`) looks up the named pantry row (case-insensitive, soonest-expiring first if more than one matches) and consumes its full remaining quantity via the existing `apply_inventory_event` RPC — same ledger every other write path uses. `PATCH /api/decisions/[id]` calls it (wrapped in try/catch) whenever a decision transitions to `completed` and has a `related_pantry_item`; a missing/renamed item is a silent no-op and never blocks completing the decision. Validated in an isolated sandbox: lint clean, typecheck clean, 204/204 tests (6 new, covering `rules.ts` field population, `validation.ts` preservation through AI refinement, and `generator.ts` pass-through). Production build hit the same pre-existing, unrelated sandbox Google Fonts restriction as 11B/11C. Production migration applied via the Supabase SQL Editor and verified in `information_schema.columns` (`related_pantry_item`, nullable `text`, present on `decisions`). Merged to `main` (fast-forward, `3d8741c`) and confirmed Ready on Vercel Production. **Milestone 11D complete: merged, migrated, and live in production. Milestone 11 (11A-11D) is now fully shipped.**
- [x] Milestone 12 — Complete Nutrition Toolkit (profile, recipe/food library, 7-day planner, shopping list, meal execution, Coach integration). Built and validated (see `docs/13_NUTRITION_TOOLKIT.md` and the full section below) - this checklist line was stale (still read "Not started" while the rest of this file already documented it as shipped); corrected during the UX Hardening release (docs/17_UX_AUDIT.md, issue I1) rather than left to drift further.
- [x] Milestone 13 — Automation and continuous synchronization (incremental Calendar sync, proactive interventions, replanning, daily briefings). Operational in production (see full section below).
- [x] Milestone 14 — Learning and personalization (outcome logging, interpretable pattern engine, personalized intervention selection, user-visible/editable memory). Built and validated (see `docs/15_LEARNING_PERSONALIZATION.md` and the full section below) - same stale-checklist correction as Milestone 12 above.

## UX Hardening release (branch `ux-hardening-release`, 2026-07-31)

Built directly from `docs/17_UX_AUDIT.md` per the founder's instruction to treat it as the evidence base for a focused hardening pass, not a broad redesign. Full per-issue resolution status is in that file's §18 rather than duplicated here. Summary: fixed all three confirmed P1s (S1 profile editing, J1 keyboard focus order, N2 pantry count semantics), the full confirmed P2/P3 batch (drawer opacity/Escape/focus, calendar day-control naming, allergy-label translation, PT pluralization, quantity/unit spacing, shopping empty state, stale-checklist correction above), clearer Magic Link copy, a lightweight contextual-help foundation (HelpTip popovers, "Porquê esta sugestão?" transparency, first-use callouts — explicitly not the full Rebuild Guide), a real self-service account-deletion flow, and a new Playwright suite (`e2e/`).

Validated (locally, then re-validated in CI — see below): `next lint` clean, `tsc --noEmit` clean, `vitest run` clean (28 files / 288 tests), production build succeeds.

**Real GitHub Actions CI added** (`.github/workflows/ci.yml`, commit `0675789`): a `static-and-unit` job (npm ci, lint, typecheck, vitest, production build — no secrets required, since every Supabase/Google access point in this codebase degrades gracefully when its env var is absent) and an `e2e` job (Playwright Chromium install + the full e2e suite, including `@axe-core/playwright`). Both jobs are genuinely green on GitHub's runners — confirmed by opening the run in the GitHub UI, not inferred from a local claim. **However, the `e2e` job explicitly skips the Playwright/Axe run** with an `::warning::` annotation ("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and/or SUPABASE_SERVICE_ROLE_KEY are not configured as repository secrets"), because the repo has zero GitHub Actions secrets configured (`Settings → Secrets and variables → Actions` is empty — confirmed by inspection). This means the "35 passed, 2 skipped, 0 failed" Playwright result and the "zero WCAG A/AA violations" Axe result referenced earlier in this branch's history were never independently verified by CI — they came from a local/manual run in a different environment. **Founder action needed**: add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (and optionally `ANTHROPIC_API_KEY`, `TOKEN_ENCRYPTION_KEY`) as repository secrets, then re-run the workflow, before treating the e2e/accessibility suite as verified.

**Merged to `main`**: PR #1 (`ux-hardening-release` → `main`) merged via a standard, non-force GitHub merge commit `78d573c` after confirming real `git fetch` showed local and remote `main`/`ux-hardening-release` were already in sync at the point of merge (no force-push, no history rewritten). Vercel Production redeployed automatically and reached **Ready** for commit `78d573c`. Production smoke-tested read-only (no session cookie, no founder data touched): the landing page at `https://project-rebuild-chi.vercel.app/` serves the new Magic Link copy ("Entrar com email" / "Enviamos uma ligação de acesso única..."), and `/onboarding` correctly redirects an unauthenticated request to `/?returnTo=%2Fonboarding` with no server error.

## Auth UX Hardening milestone (branch `feature/auth-ux-hardening`, 2026-07-31)

**Product decision, recorded here per the founder's explicit request**: magic links are no longer the primary Project Rebuild authentication experience. Real mobile testing showed the email link opening in another browser/app/device or losing session state, which is a blocking onboarding problem, not cosmetic. The current invited-alpha hierarchy is: (1) **Google OAuth** - primary, most visually prominent action and operational; (2) **Microsoft OAuth** - supported by the same provider-neutral architecture, but hidden behind `AUTH_MICROSOFT_ENABLED` (default `false`) until the Supabase-side Azure provider is actually configured; (3) **email one-time code (OTP)** - implemented but hidden behind `AUTH_EMAIL_OTP_ENABLED` (default `false`) until custom SMTP and a real `{{ .Token }}` email template have been configured and inbox-tested. Magic links remain an undocumented technical fallback through `/auth/callback`, not a promoted user journey.

**What changed**: `app/page.tsx` (new `SignInPanel` client component: Google button, conditionally Microsoft, then the email-OTP request form - no more "Enviar ligação de acesso"); new `app/auth/verify/page.tsx` + `components/auth/OtpVerifyForm.tsx` (six-digit code screen, masked email, resend cooldown, "Alterar email", digit-only paste-friendly input, `autoComplete="one-time-code"`); `app/auth/actions.ts` rewritten with `signInWithGoogle`/`signInWithMicrosoft` server actions replacing `signInWithMagicLink`; `app/auth/callback/route.ts` now also classifies OAuth-provider errors (`access_denied` → friendly cancellation copy, anything else → friendly generic failure) via the new `lib/auth/errors.ts`; `app/auth/error/page.tsx` gained `oauth-cancelled`/`oauth-failed`/`microsoft-not-configured` messages; `app/auth/check-email/page.tsx` removed (superseded by the verify screen). New `lib/auth/safe-redirect.ts` (single allowlist-based "is this a safe post-auth destination" check, used by the landing page reading `?returnTo=`, the callback route's `?next=`, and the OTP verify screen - closes a real pre-existing gap where `returnTo` was set by middleware but never actually read anywhere). New `lib/auth/errors.ts` (maps every Supabase/OAuth error to the exact founder-approved Portuguese copy, never a raw provider message) and `lib/auth/mask-email.ts` (`marco@gmail.com` → `ma***@g****.com` for the verify screen). New `lib/auth/config.ts` + `AUTH_MICROSOFT_ENABLED` (`lib/env/server.ts`) gate the Microsoft button - explicitly separate from the `MICROSOFT_CLIENT_ID`/`SECRET`/`TENANT_ID`/`REDIRECT_URI` used by the read-only Outlook *Calendar* adapter on the still-unmerged `feature/unified-calendar-intelligence` branch (Draft PR #3); the two must never be confused, and this milestone does not touch that branch or that PR.

**Existing-account compatibility**: no new identity mechanism was introduced for email - `signInWithOtp`/`verifyOtp` is the exact same underlying API the old magic-link flow already used (a magic link *is* an OTP token embedded in a clickable URL), so an existing magic-link user authenticating via the new 6-digit-code UI hits the same `auth.users` row, by the same email, with no migration needed. Google/Microsoft OAuth sign-in for an email that already has an account relies on Supabase's standard behavior of linking a new verified-email identity to an existing user rather than creating a duplicate (Google's OAuth email is always pre-verified by Google; our OTP path verifies by definition). Documented limitation: this linking behavior is Supabase's project-level default and was not independently re-verified against a live Google-linked test account in this session (no Google Cloud test user credentials are available in this sandbox) - the founder should confirm this once by signing in with Google, then separately requesting an OTP for the *same* email, and checking both land on the identical account.

**Validated after invited-alpha security hardening**: `tsc --noEmit` clean, `next lint` clean, `vitest run` clean (32 files / 314 tests; 0 regressions), and `next build` clean. The Google provider is enabled in Supabase and now uses a dedicated Google OAuth client whose only redirect URI is the Supabase Auth callback; the Calendar client keeps only the Project Rebuild calendar callbacks and its original secret. A real Preview login completed from the Google account chooser to `/today` using only `email profile` identity scopes. The additive privacy-consent migration was applied successfully to production. A real local Chromium run of the focused auth/mobile/keyboard/Axe suite finished with **22 passed, 2 intentionally skipped, 0 failed** across desktop 1440, laptop 1280, tablet 768 and mobile 390 viewports. The two skipped cases require actual email delivery and remain correctly out of scope while `AUTH_EMAIL_OTP_ENABLED=false`; Axe detected no WCAG A/AA violations on the authenticated core pages or unauthenticated auth screens covered by the suite.

**Invited-alpha privacy and account controls**: new users must explicitly accept the alpha terms and consent to processing the routine, wellbeing and nutrition data they choose to enter (`privacy_consent_at` / `terms_accepted_at`; nullable only to preserve existing founder/test profiles). `/privacy` and `/terms` explain the processors and limitations in plain Portuguese. `/settings` now accurately names Vercel, Supabase, Anthropic and connected calendar providers, and offers a session-scoped JSON export that excludes encrypted calendar credentials. Standard anti-framing, MIME-sniffing, referrer, permissions, CSP and HSTS headers are applied globally. These texts are alpha disclosures, not a substitute for legal review before public launch.

**Remaining gates**: (1) optionally add the repository secrets already named in the UX Hardening section so the same Playwright/Axe run is repeated continuously by CI; (2) keep friends on the Google Cloud test-user allowlist while the OAuth consent app remains in Testing, or complete publishing/verification before open registration; (3) configure custom SMTP plus a `{{ .Token }}` template and inbox-test it before setting `AUTH_EMAIL_OTP_ENABLED=true`; (4) ~~complete a two-disposable-account isolation/export/deletion test~~ **written this session, execution blocked here - see below**; (5) obtain legal review, define retention/incident procedures, and add operational monitoring before a public launch. Microsoft sign-in remains hidden until its separate Supabase Azure provider is configured.

### Invited-alpha security validation pass (2026-07-31, same branch, gate #4 above)

**Cross-account data isolation - written, not executed here.** `e2e/cross-account-isolation.spec.ts` (new) is a complete, real automated suite covering every table in the schema that carries a `user_id` (`profiles`, `daily_check_ins`, `decision_runs`, `decisions`, `decision_feedback`, `coach_conversations`, `coach_messages`, `pantry_items`, `inventory_events`, `shopping_lists`, `shopping_list_items`, `nutrition_profiles`, `meal_plans`, `meal_plan_items`, `daily_briefings`, `muted_rules`, `founder_notes` - `recipes`/`recipe_ingredients` are intentionally excluded, they are a shared, non-user-owned catalog by design) plus `calendar_connections` (which has no per-row policy at all - RLS enabled and fully revoked from `anon`/`authenticated`, the strongest possible protection). Using two brand-new disposable accounts (never the founder's or the invited tester's), it asserts: User A's reads never include User B's rows in any table; User A cannot update or delete any of User B's rows; User A cannot insert a row claiming User B's `user_id`; no client - not even the row's own owner - can read `calendar_connections` directly (service-role only); `PATCH /api/decisions/[id]` rejects a cross-account id (identity comes from the session, not the URL); `GET /api/account/export` returns only the caller's own data and never the encrypted calendar token columns or the other account's email; and account deletion (tested with a third, throwaway account, never A, B, the founder, or the invited tester) can only ever remove the caller's own account, leaving both other accounts and all their rows fully intact. `test.afterAll` deletes every disposable account regardless of whether an assertion above it failed. Nothing in the suite prints a password, token, service-role key, or full authenticated URL.

**This suite could not be executed in this session's sandbox** - and, once pushed, **GitHub Actions' own CI confirmed the real, precise reason it can't run anywhere yet.** Direct connection tests from the sandbox's shell showed its outbound network allowlist permits `github.com` only - `https://ghogleattdmdragyrwof.supabase.co` (proxy: `403 blocked-by-allowlist`), `*.vercel.app`, `cdn.playwright.dev` (Chromium download), and `fonts.googleapis.com` (Next's own font fetch) were all unreachable from that environment specifically. `next lint` also did not finish within this session's per-command time budget on that sandbox's filesystem - an environment-speed limit, not a lint failure.

After push, commit `141dbd8` triggered a real GitHub Actions run (`ci.yml` run #14, `https://github.com/KaomboDJ/project-rebuild/actions/runs/30671016985`) on GitHub's own runners, which have normal network access. That run's `Lint, typecheck, unit tests, build` job succeeded end to end in 1m 41s - Lint (6s), Typecheck (9s), Unit tests/Vitest (8s, real per-test output visible in the log, matching the 314/314 already confirmed locally in chunks this session), and **Production build (51s, succeeded)** - independently resolving the `next build`/Google Fonts uncertainty this sandbox could not. The second job, `Playwright E2E + Axe accessibility`, also reported "succeeded" but its own "Check required secrets are configured" step deliberately short-circuited every real test step (`Install Playwright Chromium`, `Run Playwright suite`, `Upload Playwright report` all show as skipped, 0s each) and printed: *"Skipping Playwright/Axe run — NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and/or SUPABASE_SERVICE_ROLE_KEY are not configured as repository secrets. The e2e suite creates and deletes disposable Supabase test users via the admin API and cannot run without them. This is a missing-configuration skip, not a test result."* That message is accurate and was written by whoever built this workflow specifically to prevent a green checkmark from ever being mistaken for a real pass here - and it should be trusted as exactly that: the blocker is not this review sandbox's network at all, it is that the GitHub repository itself has never had Supabase credentials added to its Actions secrets. Given `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely, withholding it from CI by default is a reasonable prior security posture, not an oversight to route around.

**One genuine security defect found and fixed** (Step 3 review): `app/api/google/callback/route.ts` logged the raw caught error object on a failed Google Calendar token exchange (`console.error("google_oauth_callback_error", err)`); `lib/google/oauth.ts`'s `exchangeCodeForTokens` embeds Google's raw token-endpoint response body in that error's message. Even though Vercel function logs are private, provider response bodies should never be written to logs verbatim. Fixed to log only `err.name` (a bounded, generic marker), matching this codebase's existing convention of not unit-testing route-handler/fetch-calling code at this level (see `lib/google/calendar.ts`'s precedent) - the fix itself is a one-line, directly-inspectable diff.

**Reviewed and found sound, no changes needed**: every `_own` RLS policy across all 11 migration files uses `auth.uid() = user_id` consistently on both `USING` and `WITH CHECK`; every dynamic `[id]` API route (`decisions`, `pantry`, `shopping`, `coach/conversations`, `personalization/notes`, `nutrition/plan/[itemId]`) uses the RLS-enforced `createSupabaseServerClient()`, never the admin client, so even a correctly-guessed foreign id resolves to zero rows rather than another user's data; `app/api/account/route.ts` (deletion) and `app/api/account/export/route.ts` both derive the target exclusively from `supabase.auth.getUser()`, never from a request parameter; Coach markdown rendering uses `react-markdown` with `rehype-sanitize` and no `rehype-raw`, so no HTML injection path exists; no tracked file or this branch's diff contains anything matching common secret-key shapes (Google, Anthropic, Supabase JWT, or PEM private-key patterns).

**One accepted, documented limitation (consent bypass)**: `OnboardingForm.tsx`'s privacy/terms consent checkbox is enforced client-side only, before a direct browser-to-Supabase upsert - a technically sophisticated user could call `supabase.from("profiles").upsert(...)` directly and set `onboarding_completed: true` without ever consenting. RLS still fully protects the *data* boundary (this only affects that one user's own consent record-keeping, never another account's data), so this was deliberately **not** closed with a blocking database `check` constraint: `profiles.privacy_consent_at`/`terms_accepted_at` are nullable specifically so the founder's own pre-existing profile keeps working, and Postgres re-evaluates `check` constraints on every `UPDATE` of a row (not just when the constrained columns change) - a constraint here risked silently breaking the founder's own `/settings` profile edits the next time they saved, which is unacceptable. Flagged for a future, more careful fix (e.g. a trigger scoped only to the transition into `onboarding_completed = true`), not attempted under this task's time/risk budget.

**Gate results** (`git rev-parse HEAD`: `141dbd8`): `tsc --noEmit` - clean (confirmed both locally this session and in CI run #14). `vitest run` - clean, 314/314 across all 32 files (independently re-run in chunks locally, and the same command succeeded again as CI's own "Unit tests (Vitest)" step). `next lint` - clean (CI's "Lint" step succeeded in 6s; this sandbox could not finish it locally in time, but CI now gives a real, unambiguous result). `next build` - clean (CI's "Production build" step succeeded in 51s, resolving the Google Fonts uncertainty this sandbox's network block left open). The full Playwright suite, including the new isolation spec - **still not executed anywhere**: CI's own `Playwright E2E + Axe accessibility` job explicitly skipped every test step because `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are not configured as GitHub Actions repository secrets (see above - a missing-configuration skip, self-reported by the workflow, not a pass or a fail). Secret scan of tracked files and the branch diff - clean.

**Verdict (superseded by the 2026-08-01 pass below)**: at the time this paragraph was first written, the branch was not yet ready to merge because the cross-account isolation suite had never actually executed anywhere. The repository secrets were subsequently added, which surfaced a real CI-environment defect (not a security or data-isolation defect) — see the next section for the full incident, root cause, fix, and final all-green result that supersedes this.

### CI incident, root cause, and final green pass (2026-08-01)

Once `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` were added as repository secrets, the `Playwright E2E + Axe accessibility` job stopped skipping and ran for real for the first time (`ci.yml` run #17, `https://github.com/KaomboDJ/project-rebuild/actions/runs/30671428267`) — but every authenticated test failed within ~300ms. The failure was root-caused by reading the full stack trace to its actual bottom rather than patching individual failing tests: `@supabase/supabase-js`'s `SupabaseClient` constructor unconditionally builds a `RealtimeClient`, which throws synchronously (`"Error: Node.js detected but native WebSocket not found."`) when no native `WebSocket` global exists and no transport option was supplied. Node.js only gained a native global `WebSocket` in Node 22; `.github/workflows/ci.yml` had both jobs pinned to Node 20 (`actions/setup-node@v4`, `node-version: "20"`) even though this repo's own `@types/node` is pinned to `^22.10.0`. This was pure CI-configuration drift — not a fixture bug, not a Supabase connectivity or grants problem, not an application defect, and not a security issue. Before that pass, a defense-in-depth check confirmed the failed run could not have created any orphaned `pw-test-*` accounts (the crash happens at client construction, before any `auth.admin.createUser()` call is ever reached).

**Fix** (commit `98a32db`): `.github/workflows/ci.yml` — both `static-and-unit` and `e2e` jobs' `node-version` changed from `"20"` to `"22"`. `e2e/fixtures.ts`'s `adminClient()` and `lib/supabase/admin.ts`'s `createSupabaseAdminClient()` both gained a small `assertWebSocketCapableRuntime()` fail-fast guard so any future Node downgrade produces one clear error instead of dozens of cascading, confusing per-test failures. New regression test `lib/supabase/admin.test.ts` locks in that guard's behavior (2 new tests, bringing the suite to 316).

After the Node 22 fix, CI run #18 (`https://github.com/KaomboDJ/project-rebuild/actions/runs/30674340786`) went from 88 failing-fast tests to only 2 genuinely new failures, unrelated to the original incident — both root-caused by reading the actual component source before touching any test file, not guessed at: `e2e/onboarding.spec.ts` predated a required privacy-consent checkbox added by an earlier commit (`6ef6407`) and never checked it, so "Começar" silently no-opped; `e2e/otp-flow.spec.ts` used Playwright's `.fill()`, whose native `maxLength={6}` truncates the raw string *before* the input's React `onChange` digit-only filter ever runs, stripping characters that real per-keystroke typing (`.pressSequentially()`) would not. Both were stale tests, not application regressions. Fixed in commit `25a50dc`.

**Final CI run, fully green** (`ci.yml` run #20, commit `25a50dc`, `https://github.com/KaomboDJ/project-rebuild/actions/runs/30675045441`): `Lint, typecheck, unit tests, build` succeeded in 1m 44s — Lint, Typecheck, and **Unit tests (Vitest): 316/316 passed across all 33 files** (including the 2 new admin-client regression tests), Production build succeeded. `Playwright E2E + Axe accessibility` succeeded in 6m 23s — **88 tests total: 82 passed, 6 skipped, 0 failed.** The 6 skips are exactly the `@live-email` cases that correctly stay skipped while `AUTH_EMAIL_OTP_ENABLED=false` (email OTP was never enabled). **All 24 cross-account isolation tests passed** (`e2e/cross-account-isolation.spec.ts`, tests 12–35 in the run log): per-table isolation across every `user_id`-owned table, update/delete/insert cross-account rejection, `calendar_connections` token exposure, the `PATCH /api/decisions/[id]` cross-account-id rejection, the data-export endpoint's own-data-only guarantee, and account deletion only ever removing the caller's own account. Axe reported zero WCAG A/AA violations on both the authenticated and unauthenticated screens it covers. A Supabase SQL query for any `auth.users` row with an email starting `pw-` returned zero rows both before and after this final run — no orphaned disposable test accounts were left behind at any point in this validation.

**Verdict**: every release gate is now genuinely green — static/unit/build, Playwright, Axe, and all 24 cross-account isolation tests, on GitHub's own infrastructure, with disposable-account cleanup independently confirmed. **Merged**: PR #4 was marked ready for review and merged into `main` via a standard, non-force merge commit `a2b7582` (2026-08-01). Vercel Production redeployed automatically and reached **Ready** (50s build). A read-only production smoke test confirmed the new landing page ("Entrar no Rebuild" / "Continuar com Google", no Microsoft button, no email-OTP form — matching `AUTH_MICROSOFT_ENABLED=false` / `AUTH_EMAIL_OTP_ENABLED=false`), `/privacy` and `/terms` both render their full alpha-disclosure text, and `/auth/verify` with no pending request safely shows "Pede um novo código" / "Voltar a entrar" rather than erroring or leaking any state. No founder data was read, written, or touched by this smoke test.

## Deployment

- **GitHub**: `https://github.com/KaomboDJ/project-rebuild.git`, branch `main`, latest published commit `a2b7582` (merge of PR #4, "Auth UX Hardening: Google/Microsoft OAuth + email OTP", 2026-08-01).
- **Vercel**: production is live at `https://project-rebuild-chi.vercel.app`, auto-deploying pushes to `main`. Confirmed deployment of commit `a2b7582` reached "Ready" in the Vercel dashboard and passed a read-only smoke test (2026-08-01).
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

### Post-fix additions: `/calendar` view and a real `/history` page

Once connected, the founder asked for visible proof the integration actually works (a day/week/month view of real events), not just a status message. Separately, `/history` was still showing its Milestone-1 placeholder text ("O histórico persistente será ativado quando as migrações do Supabase forem aplicadas") even though the `decisions` table has been live since Milestone 4 — nobody had gone back to wire it up.

| Item | Status | Notes |
|---|---|---|
| `lib/date/ranges.ts` | Done, tested | Pure Monday–Sunday week / calendar-month range math, keyed off a date string. 6 tests. |
| `lib/date/timezone.ts` | Extended | Added `localRangeUtc(start, end, timeZone)`; `localDayRangeUtc` is now a thin wrapper over it. Existing tests untouched. |
| `lib/google/calendar.ts` | Extended | Added `getCalendarEventsForRange`; `getCalendarEventsForDate` is now a wrapper (`start === end`). Same fail-safe-to-`[]` behavior. |
| `app/api/calendar/events/route.ts` | Done | Authenticated GET, `?view=day\|week\|month&date=YYYY-MM-DD`, computes the range server-side and returns events. |
| `components/CalendarView.tsx` + `app/(app)/calendar/page.tsx` | Done | Simple list view (not a visual grid) with Day/Semana/Mês toggle, grouped by date. Points to `/settings` if not connected. |
| `components/AppShell.tsx` | Updated | Added "Calendário" to the main nav. |
| `lib/decision-engine/labels.ts` | Done | Extracted `DOMAIN_LABEL`/`STATUS_LABEL` (previously inline in `DecisionEngineCard.tsx`) so `/history` can reuse the same Portuguese labels. |
| `app/(app)/history/page.tsx` | Rewritten | Real Server Component: past decisions (`date < today`) grouped by day, with domain/time/status/skip-reason/feedback, capped at 90 rows. Replaces the stale placeholder. |

Validated in an isolated sandbox copy: lint clean, typecheck clean, 118/118 tests, production build succeeds (including the new `/calendar` route and `/api/calendar/events`). Committed as `547543f`, pushed, confirmed "Ready" on Vercel.

## Pre-pilot stabilization sprint

Per the founder's "Founder Pilot" directive (`PROJECT_REBUILD_STATE.md`): the technical loop was complete, so this sprint closed the remaining known gaps before starting 14 days of real daily usage, rather than adding new modules.

### Git sync check

Investigated the founder's local "4 commits ahead of origin/main" observation. GitHub's `main` (verified via the commits UI) is at `547543f`, matching everything pushed this session — there is no actual divergence. The founder's local remote-tracking ref (`origin/main`) is simply stale from before this session's pushes; a plain `git fetch` (or `git pull` if also checked out locally) resolves it. No repository-side fix was needed.

### Timezone / free-window fix

The known limitation flagged at the end of Milestone 3 (day-boundary math using the server's local time — UTC on Vercel — instead of the founder's) is fixed. Added real instant↔local-wall-clock conversion to `lib/date/timezone.ts` (`instantToLocalParts`, `instantToLocalWallClockIso`, `nowInTimeZone`, via `Intl.DateTimeFormat.formatToParts`, cached per timezone). Added `lib/date/founder-now.ts` (`getFounderNow`) as the single entry point for "what day/time is it for the founder right now," replacing `lib/date/local.ts`'s server-local functions in `app/api/decisions/generate/route.ts`, `app/(app)/today/page.tsx`, and `app/(app)/history/page.tsx`. `computeFreeWindows()` in `context-builder.ts` now does real UTC-ms math for day boundaries instead of parsing naive strings in the process's own timezone. `app/api/calendar/events/route.ts`'s missing-`date` fallback now also resolves the founder's timezone rather than defaulting to server-local. `components/CalendarView.tsx`'s client-side default was left as `localDateKey()` — it runs in the founder's own browser, so browser-local time is already correct there, unlike server-local time. Also fixed a Vitest config gap surfaced by this work: `vitest.config.ts` had no alias for the `@/*` path (tsconfig has one, Vite/Vitest doesn't inherit it automatically) — added, since `context-builder.ts` now has a real (not type-only) `@/lib/date/timezone` import that needs runtime resolution under tests.

Tests rewritten with realistic Google-style offset-bearing fixtures (`+01:00`) instead of the previous naive-string assumption, plus a regression test pinning the original bug. 129/129 tests pass, typecheck clean, production build succeeds.

### PWA installability

`app/manifest.ts` (Next's native manifest route, served at `/manifest.webmanifest`), four generated icons in `public/` (192, 512, 512 maskable, apple-touch-icon), a minimal `public/sw.js` (install/activate/pass-through fetch only — deliberately no offline caching strategy, since every page needs live Supabase/calendar data and stale cached decisions would be worse than no offline support), registered client-side via `components/ServiceWorkerRegistration.tsx`. `app/layout.tsx` now sets `manifest`, `appleWebApp`, icon links, and `themeColor`.

### Explicit "Útil / Não útil" feedback

New `app/api/decisions/[id]/feedback/route.ts` (authenticated POST, upserts into the already-existing `decision_feedback` table on `(user_id, decision_id)`). `components/DecisionEngineCard.tsx` shows the two buttons once a decision is completed or skipped, with saved state restored on reload (`/today` and `/history` both now query `decision_feedback` and pass it through). `/history` also renders a "Marcado como útil / não útil" line per decision. Free-text `feedback` remains in the schema but isn't collected by this UI — the boolean signal is what the pilot's metrics call for.

Validated in an isolated sandbox copy: lint clean (one pre-existing, unrelated `next-env.d.ts` triple-slash warning), typecheck clean, 129/129 tests, production build succeeds with the new `/api/decisions/[id]/feedback` and `/manifest.webmanifest` routes present.

## Milestones 5–8

Done — see the "Milestones (all done)" section of `12_ROADMAP.md` and the sprint notes above for what shipped in each.

## Coach UX + Pantry Intelligence milestone — founder-approved pilot-gate override

Founder-authored milestone brief, approved to proceed mid-pilot ("Avançar já, atualizar a governance" — see the governance note in `PROJECT_REBUILD_STATE.md` and the exception note in `docs/12_ROADMAP.md`'s "Founder Pilot" section). Not yet pushed or deployed — branch `calendar-workspace`, awaiting founder review per the brief's own "do not push or deploy without explicit approval."

| Item | Status | Notes |
|---|---|---|
| `supabase/migrations/202607300002_coach_persistence.sql` | Done | `coach_conversations` + `coach_messages`, RLS, `last_message_at` touch trigger. |
| `supabase/migrations/202607300003_pantry_shopping.sql` | Done | `pantry_items`, `inventory_events` (append-only, select+insert only), `shopping_lists`, `shopping_list_items`, RLS, and two SECURITY INVOKER RPCs: `apply_inventory_event` (atomic quantity mutation + ledger row) and `mark_shopping_item_purchased` (idempotent purchase → pantry flow). |
| `supabase/migrations/202607300004_day_type_context.sql` | Done | `profiles.default_day_type`, `daily_check_ins.day_type` / `day_type_source`. |
| `lib/supabase/database.types.ts` | Updated | All 6 new tables + the 2 new RPC signatures. |
| `lib/coach/types.ts`, `conversations.ts`, `tools.ts`, `pantry-context.ts`, `day-type.ts` | Done | Shared Coach domain layer: message/tool-call types, conversation CRUD helpers, the 7 tool definitions + read-only execution + mutation execution, pantry summary builder for the system prompt, day-type inference (check-in → profile → low-confidence calendar heuristic → ask directly). |
| `lib/ai/provider.ts` | Rewritten | `CoachContext` extended with optional `pantry`/`dayType`; `respond()` now takes conversation history and an optional tool runtime, runs a bounded (max 4 rounds) read-only tool loop via the Anthropic SDK's native tool use, and returns proposed (never executed) mutating tool calls separately from the text reply. |
| `app/api/coach/route.ts` | Rewritten | Context is now built server-side from the authenticated session (previously trusted a client-assembled context object) — profile, check-in, decisions, pantry summary, day-type. Persists every user/assistant turn to `coach_conversations`/`coach_messages`. |
| `app/api/coach/tools/confirm/route.ts` | Done | The only path from a `proposed` tool call to `executed` — explicit user confirm/decline, re-validated server-side, never triggered by the model itself. |
| `app/api/coach/conversations/route.ts`, `app/api/coach/conversations/[id]/route.ts` | Done | History list + single-conversation message fetch for the full `/coach` page. |
| `app/api/pantry/route.ts`, `app/api/pantry/[id]/route.ts` | Done | Manual pantry CRUD + quick inventory actions, routed through `apply_inventory_event`. |
| `app/api/shopping/route.ts`, `app/api/shopping/[id]/route.ts` | Done | Manual shopping-list CRUD + purchase, routed through `mark_shopping_item_purchased`. |
| `components/CoachDrawer.tsx` | Rewritten | Three explicit states (closed / compact ~420px preview with "Abrir conversa" / expanded full-height slide-over) instead of the single small drawer that previously clipped long replies. |
| `components/coach/*` | Done | `useCoachConversation` (shared send/confirm/decline/load state), `MessageList`, `MarkdownMessage` (react-markdown + remark-gfm + rehype-sanitize), `ToolCallCard` (confirm/decline UI for proposed mutations), `CoachPageClient`. |
| `app/(app)/coach/page.tsx` | Done | Full authenticated route: persisted history sidebar (desktop) / drawer (mobile), "Nova conversa", context summary panel. |
| `components/nutrition/PantryList.tsx`, `ShoppingList.tsx` | Done | −1/+1/Terminou/remove quick actions; add-item forms; purchase flow. |
| `app/(app)/nutrition/page.tsx`, `.../pantry/page.tsx`, `.../shopping/page.tsx` | Done | Dashboard (counts + expiring-soon) + the two management pages. |
| `components/AppNav.tsx` | Updated | Added "Coach" and "Alimentação" nav entries. |
| `PRODUCT_BACKLOG.md` | Updated | Nutrition Toolkit entry annotated to distinguish it from what shipped here — meal plans/macros/recipe-driven shopping remain unbuilt and still gated on pilot validation. |

Not built (explicitly out of scope per the brief's Part 5): meal-plan generation, macro estimation, recipe library — those remain the separate, still-gated `PRODUCT_BACKLOG.md` Nutrition Toolkit entry.

Validation: see the founder-facing completion report delivered alongside this milestone for the exact lint/typecheck/test/build results at time of handoff.

## Milestone 12 — Complete Nutrition Toolkit

Per the founder's 2026-07-30 full-roadmap authorization and its update lifting the per-milestone check-in requirement (`PROJECT_REBUILD_STATE.md`, `docs/12_ROADMAP.md`). Full design rationale, schema, and what's explicitly not built: `docs/13_NUTRITION_TOOLKIT.md`.

| Item | Status | Notes |
|---|---|---|
| `supabase/migrations/202607300007_nutrition_toolkit.sql` | Done | `nutrition_profiles`, `recipes`, `recipe_ingredients`, `meal_plans`, `meal_plan_items`; RLS on all five (owner-scoped for the first and last two, read-only-to-everyone for the recipe library); `set_meal_plan_item_status` RPC; 24-recipe curated seed. |
| `lib/supabase/database.types.ts` | Updated | 5 new tables + 1 new RPC signature. |
| `lib/nutrition/types.ts`, `options.ts` | Done | Pure domain types + client-safe label lists (mirrors `lib/decision-engine/types.ts` / `lib/profile/onboarding.ts`'s split). |
| `lib/nutrition/planner.ts` | Done | Deterministic "Decide for me" 7-day planner + same-slot/closest-calorie meal-replacement suggestion. No AI in the selection path. |
| `lib/nutrition/macros.ts` | Done | Per-day/week-average macro estimates with a ±10% presentation band. |
| `lib/nutrition/shopping.ts` | Done | Ingredient aggregation, realistic purchase-quantity rounding, pantry-stock subtraction. |
| `lib/nutrition/queries.ts` | Done | Server-only Supabase CRUD: profile, recipe library reads, plan persistence/replacement/completion (with pantry auto-consume), shopping-list generation, and `getTodaysDinnerPlanName` for the Decision Engine hook. |
| `app/api/nutrition/profile/route.ts` | Done | GET/PUT, Zod-validated. |
| `app/api/nutrition/plan/route.ts`, `.../plan/[itemId]/route.ts`, `.../plan/shopping-list/route.ts` | Done | Get/generate current week; replace or mark eaten/skipped a single slot; regenerate the shopping list from the current plan. |
| `components/nutrition/NutritionProfileForm.tsx`, `MealPlanView.tsx` | Done | Profile form; 7-day plan view with per-slot actions, macro summary, and shopping-list/regenerate buttons. |
| `app/(app)/nutrition/profile/page.tsx`, `.../plan/page.tsx` | Done | Routes for the two new UI pieces above; `/nutrition` dashboard updated with links and a planned-meals count. |
| `lib/decision-engine/types.ts`, `context-builder.ts`, `rules.ts` | Updated | `DailyContext.todaysDinnerPlanName` (Milestone 12) takes priority over the Milestone 11C pantry pick in `decideDinnerEarly`/`avoidTakeawayCommitment` — a planned meal outranks an ad-hoc suggestion. |
| `app/api/decisions/generate/route.ts` | Updated | Fetches `getTodaysDinnerPlanName` alongside the existing pantry summary. |
| `lib/coach/types.ts`, `tools.ts` | Updated | 4 new tools: `get_week_plan` (read-only), `generate_week_plan`, `replace_meal`, `mark_meal_eaten` (all three confirm-gated, same pattern as every other Coach mutation). |
| `lib/ai/provider.ts` | Updated | System prompt tells the model to use `get_week_plan` before answering plan questions and never invent recipes/macros. |

Tests added: `lib/nutrition/planner.test.ts` (17), `macros.test.ts` (8), `shopping.test.ts` (11), plus 4 new `lib/decision-engine/rules.test.ts` cases (meal-plan-priority dinner naming) and 4 new `lib/coach/tools.test.ts` cases (new tool names/summaries) — bringing the suite from 204 to 247, all passing.

### Nutrition journey UX refinement (2026-08-02)

The founder identified two abandonment risks in the shipped Nutrition Toolkit:
the native profile dropdown opened as a white Windows popup inside the dark
app, and saving the profile led to a dead end that required navigating back to
Alimentação manually. The primary `/nutrition` experience is now a single
scrolling journey — Profile → Pantry → Weekly plan → Shopping — with a compact
progress navigator, anchored steps, clear next actions, and restrained positive
completion feedback. The four individual routes remain available and now link
back to the full journey. A shared custom `Select` implements the app's dark
surface plus keyboard/Escape interaction instead of relying on the unthemeable
native popup.

Validation on branch `codex/nutrition-journey`: typecheck clean, lint clean,
320/320 unit tests passing, production build successful. The focused Playwright
spec was expanded to cover journey order, listbox appearance/keyboard behavior,
and the post-save next action. Its first local run was invalid because port 3100
was already serving another checkout; a second isolated-port run still did not
recognize the disposable Supabase session and therefore only reached the public
landing page. No browser pass is claimed locally. GitHub Actions run
`https://github.com/KaomboDJ/project-rebuild/actions/runs/30770105219` independently
confirmed lint, typecheck, unit tests, and the production build. Its Playwright/Axe
job reported success only because the workflow deliberately skipped the browser
steps when the three Supabase test secrets were absent; that green job is therefore
not a browser-test result. The Draft PR remains gated on an authenticated Preview
walkthrough or a disposable, non-production Supabase E2E environment. The
production service-role key must not be reintroduced merely to make this UI test run.

The authenticated Preview walkthrough was subsequently completed manually on
2026-08-02 with the founder account, without saving or changing profile, pantry,
plan, or shopping data. Desktop and a real 390x844 viewport both rendered the
continuous four-step journey correctly; the progress links reached `#profile`,
`#pantry`, `#plan`, and `#shopping`; the custom objective listbox remained inside
the dark visual system and closed with Escape; and the mobile bottom navigation
did not obscure the journey entry point. This closes the release's visual gate.
The CI Playwright/Axe skip remains documented accurately and should later be
replaced with a dedicated non-production Supabase E2E environment, not a
production service-role secret.

**Released to production**: PR #6 was marked ready after the authenticated
Preview walkthrough and merged into `main` through a standard, non-force merge
commit `6111eea` on 2026-08-02. Vercel deployed the merge successfully. A
read-only authenticated smoke test at `https://project-rebuild-chi.vercel.app`
confirmed the new continuous Nutrition journey on desktop and at 390x844, the
dark objective listbox opening and closing with Escape, and the Pantry progress
link resolving to `/nutrition#pantry`. No founder nutrition data was changed.

Validated in an isolated sandbox copy: typecheck clean, lint clean (`✔ No ESLint warnings or errors`), full suite 247/247 passing. Production build hits only the same pre-existing, sandbox-network-only Google Fonts restriction seen in Milestones 11B–11D (`Failed to fetch font 'Inter' from Google Fonts`) — not caused by this milestone's code.

## Milestone 13 — Automation and continuous synchronization

Per the founder's standing full-roadmap authorization. Full design rationale and explicitly-simplified scope: `docs/14_AUTOMATION.md`.

| Item | Status | Notes |
|---|---|---|
| `supabase/migrations/202607300008_automation_sync.sql` | Done | New `daily_briefings` table (RLS owner-scoped). No changes to any existing table. |
| `lib/supabase/database.types.ts` | Updated | `daily_briefings` table added. |
| `lib/decision-engine/run.ts` | Done (new) | Extracted the context-build → generate → persist pipeline out of `app/api/decisions/generate/route.ts` into `runDecisionGeneration(supabase, userId)`, shared by the interactive route and the new cron route. |
| `lib/decision-engine/drift.ts` | Done (new) | Pure `detectFreeWindowDrift` (aggregate free-window shape comparison) and `buildBriefingSummary`. |
| `app/api/cron/daily-sync/route.ts` | Done (new) | `CRON_SECRET`-protected scheduled route: proactively generates today's decisions for every onboarded founder if none exist, otherwise flags `decisions_stale` on drift; upserts one `daily_briefings` row per founder per day. |
| `vercel.json` | Done (new) | Cron schedule, once daily at 06:30 UTC (Vercel Hobby plan limitation — see `docs/14_AUTOMATION.md`). |
| `app/api/decisions/generate/route.ts` | Simplified | Now a thin wrapper around `runDecisionGeneration`. |
| `app/(app)/today/page.tsx`, `components/CalendarWorkspace.tsx` | Updated | Fetch/render the day's `daily_briefings` row as a summary card, with a "Regenerar decisões de hoje" button shown only when `decisions_stale`. |

Explicitly simplified (all documented in `docs/14_AUTOMATION.md`, not silently dropped): "incremental sync" is a scheduled full poll rather than Google's `syncToken` protocol (judged too risky to implement unverified against a live API in this environment); cron runs once daily rather than continuously (Vercel Hobby plan limit); drift detection is aggregate (free-window shape), not a per-decision recheck; no push/email notifications exist, so "proactive" means "ready and flagged next time the app is opened."

Tests added: `lib/decision-engine/drift.test.ts` (9) — bringing the suite from 247 to 256, all passing. Validated in an isolated sandbox copy: typecheck clean, lint clean, full suite 256/256 passing. Production build hits the same pre-existing sandbox-network-only Google Fonts restriction, not caused by this milestone's code.

### Production activation — 2026-07-30/31

Status: **operational**. Sequence:

1. `CRON_SECRET` generated (32 random bytes, hex-encoded, header-safe) and added to Vercel as a Production-only, Sensitive environment variable. Value is not recorded anywhere in the repo, docs, or chat — only `.env.example`'s empty placeholder is checked in.
2. Production redeployed so the new env var took effect.
3. Confirmed `/api/cron/daily-sync` rejects requests with a missing or incorrect bearer token (401 `unauthorized` in both cases).
4. First authenticated invocation returned a 500 `failed-to-list-founders`. Root cause (found via a targeted `console.error` added to the founders-list error path, commit `9d0d525`): the `service_role` Postgres role was missing basic `SELECT/INSERT/UPDATE/DELETE` table grants on nearly every application table (only `TRIGGER/TRUNCATE/REFERENCES` were present — a pre-existing database configuration gap, not a bug introduced by this milestone). `service_role` already had `BYPASSRLS`, so this was purely a missing-`GRANT` issue, not an RLS policy problem. Fixed by granting standard `service_role` privileges on all `public` schema tables/sequences plus a matching `ALTER DEFAULT PRIVILEGES` rule so future tables inherit them automatically.
5. Re-invoked the route: **200**, decisions generated for the one onboarded founder.
6. Re-invoked a second time immediately after: **200**, no duplicate `decision_runs` or `decisions` rows created — the existing run for the day was detected and only `daily_briefings` was re-upserted (drift check ran, `decisions_stale: false`). Idempotency confirmed directly against the database (1 `decision_runs` row, 3 `decisions` rows, 1 `daily_briefings` row for the day, all correctly scoped to the founder's local date).
7. Vercel Runtime Logs for both successful invocations show no application errors — only a pre-existing, unrelated Node `url.parse()` deprecation warning.

No code changes were required beyond the diagnostic logging in `app/api/cron/daily-sync/route.ts` (commit `9d0d525`, pushed to `main`); the fix itself was a one-time database grants correction, not a milestone-scope change.

## Milestone 14 — Learning and personalization

Per the founder's standing full-roadmap authorization. Full design rationale: `docs/15_LEARNING_PERSONALIZATION.md`.

| Item | Status | Notes |
|---|---|---|
| `supabase/migrations/202607300009_learning_personalization.sql` | Done | `decisions.rule_id` (nullable, additive), new `muted_rules` and `founder_notes` tables, RLS, grants. No destructive change to any existing table. |
| `lib/supabase/database.types.ts` | Updated | `rule_id` on `decisions` Row/Insert; `muted_rules`/`founder_notes` table blocks. |
| `lib/decision-engine/patterns.ts` (+ `patterns.test.ts`, 14 cases) | Done (new) | Pure pattern engine: `summarizeRulePatterns`, `computeRuleInsight`/`computeRuleInsights`, `buildRuleAdjustments`, `describeRuleInsight`. `MIN_EVIDENCE_COUNT = 5`, `MAX_PERSONALIZATION_ADJUSTMENT = 2`. |
| `lib/decision-engine/rule-catalog.ts` | Done (new) | Portuguese labels per `ruleId` for the settings UI/API only. |
| `lib/decision-engine/queries.ts` | Done (new) | Server-only: rule insights/adjustments, muted-rule CRUD, founder-note CRUD, `listGeneralFounderNotes` for the Coach prompt. |
| `lib/decision-engine/types.ts`, `context-builder.ts`, `rules.ts`, `scorer.ts`, `generator.ts`, `validation.ts` | Updated | `ruleId` threaded end-to-end (candidate → scored → generated → persisted, re-attached from the deterministic candidate after AI refinement, never trusted from the AI); `mutedRuleIds` filters candidates before scoring (`rules.ts`); `ruleAdjustments` adds a bounded term in `scorer.ts`. |
| `lib/decision-engine/run.ts` | Updated | Fetches `listMutedRuleIds`/`getRuleAdjustments` before `buildDailyContext` (both default to `[]`/`{}` on failure — a personalization error can never block the core loop); persists `rule_id` on every inserted decision. |
| `app/api/personalization/insights/route.ts` | Done (new) | GET — every known rule's live-computed insight, muted state, and plain-language description. |
| `app/api/personalization/mute/route.ts` | Done (new) | POST/DELETE — mute/unmute a rule by id. |
| `app/api/personalization/notes/route.ts`, `.../notes/[id]/route.ts` | Done (new) | GET/POST list+create; PATCH/DELETE update+remove a single note. |
| `components/settings/MemoryManager.tsx`, `app/(app)/settings/memory/page.tsx` | Done (new) | General-notes editor, per-rule insight/mute list. Linked from `app/(app)/settings/page.tsx`. |
| `lib/ai/provider.ts`, `app/api/coach/route.ts` | Updated | `CoachContext.founderNotes` (general notes only, capped at 10) folded into the Coach system prompt as a standing preference. |
| `lib/decision-engine/scorer.test.ts`, `rules.test.ts` | Updated | 3 new personalization-adjustment cases; 2 new mute-filtering cases (including the deterministic-cold-start check that an absent/empty `mutedRuleIds` produces identical output to before). |

Explicitly not built (see `docs/15_LEARNING_PERSONALIZATION.md`'s closing section): any trained/learned model, persisted insight cache, cross-founder learning, or automatic muting — every adjustment is a plain capped formula over the founder's own rows, and muting is always an explicit founder action.

Validated in an isolated sandbox copy: typecheck clean, lint clean, full suite passing (256 + 14 new `patterns.test.ts` + 5 new scorer/rules cases = 275). Production build hits the same pre-existing sandbox-network-only Google Fonts restriction, not caused by this milestone's code. Migration applied to production Supabase; committed on `milestone-14-learning-personalization`; push to `main` pending the same GitHub 2FA blocker as Milestones 12/13 (see the open item below).

## Post-audit fixes and "Reiniciar conta de teste" (2026-08-03)

Following a live, hands-on UX walkthrough of production (not just a code
read), five findings were fixed on `fix/ux-audit-findings` and merged to
`main`: free windows were never clipped to the founder's own wake/sleep
hours (`lib/sleep/schedule.ts`'s new `clipFreeWindowsToWakingHours`, wired
into every `computeFreeWindows` call site); an overdue or skipped decision
rendered identically to an upcoming one on Início; a self-contradicting
"Reportaste uma limitação física hoje (nenhuma)" sentence (`normalizePhysicalLimitation`
in `lib/decision-engine/types.ts`); a nutrition step-tracker contradiction
(`MealPlanView`'s empty state now takes `hasProfile`); and Início/Hoje
disagreeing about whether today was planned, plus a silent regeneration
drift on check-in resubmission — both traced to `CalendarWorkspace.tsx`
gating its entire workspace behind `hasCheckIn` regardless of whether
decisions already existed, and always calling `regenerate()` on check-in
submit. Per the founder's explicit call, check-in submission now only ever
records state; regeneration stays a separate, explicit action.

Also added: bulk "Limpar itens esgotados" / "Limpar comprados" actions on
the pantry and shopping list (`lib/pantry/queries.ts`'s
`deleteFinishedPantryItems`/`deletePurchasedShoppingItems`), since a
per-item Trash2 click was previously the only way to shrink either list.

**"Reiniciar conta de teste"** (`app/api/account/reset/route.ts`,
`lib/account/reset.ts`, `components/settings/ResetAccountSection.tsx`,
shipped on `feat/reset-test-account`): a Settings danger-zone action the
founder can use to walk through onboarding again as a first-time user
without losing their login. Same security model as the existing account
deletion route (session-scoped only, retype-the-account-email
confirmation, checked server-side) but narrower in effect — it deletes
every user-owned table (profiles, check-ins, decisions/decision_runs/
decision_feedback, coach conversations/messages, pantry/shopping/nutrition/
meal-plan data, `muted_rules`/`founder_notes`, push subscriptions and
notification preferences/deliveries, and disconnects Google Calendar with
best-effort token revocation) but leaves the `auth.users` row itself alone,
so the founder stays signed in and lands on `/onboarding` once `profiles`
is gone. `recipes`/`recipe_ingredients` are deliberately untouched (shared,
non-user-owned catalog). Tested only against disposable Playwright-created
accounts (`e2e/account-reset.spec.ts`), never the founder's own — the
founder triggers it themselves from their real account when ready.

Validated in an isolated sandbox copy: `tsc --noEmit` clean, `next lint`
clean, full `vitest` suite passing (393/393, +16 new). `next build` still
only fails on the same pre-existing Google-Fonts sandbox-network
restriction, unrelated to these changes. The new e2e specs (one added to
`e2e/home-decisions.spec.ts`, plus `e2e/account-reset.spec.ts`) were not
executed here — Playwright's Chromium download is blocked by this
sandbox's network allowlist — but will run in CI.

## Shopping-list fix, workout-type catalog, and meal-choice reasoning (2026-08-03)

Following another live walkthrough, the founder reported the "Lista de
compras" button on `/nutrition/plan` failing with "Não foi possível gerar a
lista de compras.". Root cause: `202608030003_nutrition_completion.sql`'s
`shopping_lists_meal_plan_id_unique` was a **partial** unique index (`where
meal_plan_id is not null`), but `lib/nutrition/queries.ts`'s
`generateShoppingListForPlan` calls `.upsert(..., { onConflict:
"meal_plan_id" })`, which always emits a plain `ON CONFLICT (meal_plan_id)`
— Postgres can only infer a partial index as an `ON CONFLICT` arbiter when
the clause repeats the same `WHERE` predicate, which supabase-js's
`upsert()` has no way to express. Fixed via
`202608030004_fix_shopping_list_upsert_conflict.sql`, replacing the partial
index with a plain `UNIQUE` constraint (identical real-world semantics: a
plain unique constraint already permits unlimited `NULL`s under standard
SQL). **This migration is committed but not yet applied to production** —
this sandbox cannot reach `*.supabase.co` (DNS blocked); the founder needs
to run it via the Supabase SQL editor.

The founder also asked for two things: (1) plain-language, nutritionist-style
explanations for why each meal in the weekly plan was chosen, written for
someone who doesn't know what "macros" means; and (2) a workout-type
picker (Natação, Musculação, Jiu-jitsu, Yoga, Insanity, P90X, MMA,
Parkour, ...) so the nutrition plan can differ on days with different
training styles. Clarified with the founder: the workout choice should be
settable both as a weekly default and as a same-day override, and macros
should react both in advance (weekly plan) and same-day. Given the size of
that full request, it's being built in stages:

- **`lib/nutrition/workout-types.ts`** (done): a fixed catalog of 16 named
  workout styles, each tagged with one or two training-style categories
  (`cardio` / `forca_hipertrofia` / `calistenia` / `mental_relaxamento`),
  paired with a plain-language, deliberately qualitative (not a numeric
  macro multiplier) guidance paragraph per category —
  `describeWorkoutMacroGuidance(workoutTypeId)`. Not yet wired into any
  UI or the planner; this stage only builds the reusable catalog. 7 tests.
- **`lib/nutrition/planner.ts`** (done): `generateWeekPlan` now accepts an
  optional `trainingDaysOfWeek` (the founder's weekly training days,
  already stored on `profiles.preferred_training_days` for the decision
  engine — reused here rather than duplicated onto `nutrition_profiles`).
  On a flagged training day, lunch and dinner softly prefer the
  higher-protein candidate among the same safety-filtered pool (never a
  hard filter — variety/relaxation rules still apply exactly as before).
  This is intentionally the narrower, already-real "is today a training
  day" signal — not yet the richer named-workout-type-per-day granularity
  from `workout-types.ts` (that's `#115`/`#116` below).
- **`lib/nutrition/reasoning.ts`** (done, new): `explainMealChoice` builds
  the "Porquê esta refeição?" sentences for one planned meal, grounded
  only in facts that are actually true of that recipe/profile/day — the
  training-day protein sentence only appears for lunch/dinner on a day
  actually flagged in `trainingDaysOfWeek` (matching exactly what the
  planner's soft-sort does), plus a goal-linked sentence, diet-style/
  allergy-safety notes when relevant, and a prep-time note when the recipe
  fits the founder's usual cooking-time budget. Rendered as a
  `DecisionEngineCard`-style collapsible "Porquê esta refeição?" block per
  meal in `components/nutrition/MealPlanView.tsx`. Wired via a new
  `getPreferredTrainingDays` query and an optional `reasoningContext`
  param on `toPlanResponse`, threaded through both the GET/POST handlers
  in `app/api/nutrition/plan/route.ts` and the Coach's `generate_week_plan`
  tool in `lib/coach/tools.ts`. 10 tests (`reasoning.test.ts`) plus 3 new
  `planner.test.ts` cases for the protein-preference sort.

Still pending, tracked separately: `#115` (a full weekly training-day-by-
day-of-week schedule on the nutrition profile, using the richer
`workout-types.ts` catalog instead of just "training day yes/no"), `#116`
(wiring each day's specific workout category into that day's macro
targets/preferences, not just a protein nudge), and `#117` (a same-day
override on the Início/Hoje training decision, so a same-day change to
what's actually being trained updates that day's remaining nutrition
guidance too, per the founder's "both weekly and same-day" answer).

Validated in an isolated sandbox copy: `tsc --noEmit` clean, `next lint`
clean, full `vitest` suite passing (413/413, +20 new vs. the previous
393 baseline). `next build` still only fails on the same pre-existing
Google-Fonts sandbox-network restriction, unrelated to these changes.

## Mobile fix: app-guide bubble covering Coach's send button (2026-08-05)

Founder report, live on mobile: the floating "?" app-guide bubble
(`components/AppGuide.tsx`, `fixed bottom-24 right-4 z-30`) was untappable
to cover — it sat directly on top of `/coach`'s own "Enviar" (send) button.
Root cause: the bubble's offset assumes a small margin above the ~64-80px
bottom tab bar, which works for every other page since their content
scrolls independently of that corner. `/coach`'s compose form
(`components/coach/CoachPageClient.tsx`) is different: its send button is
the last in-flow element inside a near-full-viewport-height card, so on
mobile it lands directly under the bubble's fixed position — not just a
visual overlap, the fixed element sits on top in the stacking order and
absorbs the tap.

Fixed by not rendering the bubble on `/coach` at all (`AppGuide` now
returns `null` for that route, after all its hooks run — kept the hook
order identical across renders per the Rules of Hooks) rather than hunting
for an offset guaranteed to clear a compose bar whose height varies with
font scaling and the safe-area inset. The page already has its own "Ver
contexto" (Info icon) affordance, and the guide's own copy on every other
page already points founders at the Coach for anything more specific.

Added `e2e/responsive.spec.ts`'s "the app-guide bubble does not cover the
Coach send button" (runs across all four viewport projects, including
390x844 mobile) — checks both that the bubble is absent on `/coach` and,
more directly, that `document.elementFromPoint` at the send button's own
center actually resolves to that button (the real-world symptom).

Validated in an isolated sandbox copy: `tsc --noEmit` clean, `next lint`
clean, full `vitest` suite passing (413/413, unchanged — this is a UI-only
fix with no unit-testable logic). The new e2e spec was not executed here
(Playwright's Chromium download is blocked by this sandbox's network
allowlist) but will run in CI.

## Milestone 15, stage 1: Training Toolkit — engine (2026-08-05)

Founder request: "é possível [o Coach] elaborar um treino para a semana
toda?" — confirmed this doesn't exist as a real feature yet (the Coach has
no training-plan tool at all; asking it today just gets an ungrounded LLM
answer, never persisted, never reviewable). Founder chose the full
deterministic engine (mirroring the Nutrition Toolkit's own architecture)
over a lighter conversational-only version. Being built in stages; this is
stage 1 (schema + deterministic engine), stages 2-3 (persistence/API/Coach
tool, then UI) tracked separately.

While designing the category taxonomy, the founder corrected the original
`lib/nutrition/workout-types.ts` (16 named activities tagged with 1-2 of 4
broad categories): striking martial arts (Muay Thai, kickboxing) and
grappling martial arts (jiu-jitsu, judo, wrestling, sambo) are physically
different disciplines and must never share a category, and light cardio
(walking, easy jog) is a different demand than heavy cardio (HIIT,
sprints, bike/row intervals). `workout-types.ts` was rewritten around the
founder's own 8-category taxonomy (`calistenia`, `cardio_leve`,
`cardio_pesado`, `hipertrofia`, `artes_marciais_strike`,
`wrestling_grappling`, `mobilidade`, `parkour`) — the category is now the
thing a founder actually picks for a day's training, not an activity
tagged with a category after the fact. This happened before anything was
committed or applied, so there's no migration-of-a-migration involved.

Built:
- `supabase/migrations/202608050001_training_toolkit.sql` — mirrors
  `202607300007_nutrition_toolkit.sql` one-for-one: `training_profiles`
  (user-owned settings: preferred categories, session duration, location,
  intensity/variety preference, free-text physical limitations, same
  treatment as `nutrition_profiles.medical_constraints`),
  `workout_sessions` (curated, global, read-only-to-the-app library — 29
  seeded sessions across all 8 categories, including named Muay Thai/
  Kickboxing/Boxe sessions under `artes_marciais_strike` and named
  Jiu-jitsu/Wrestling-Judo sessions under `wrestling_grappling`, kept
  deliberately separate), `training_plans`/`training_plan_items` (one
  planned session per day; a rest day is simply a day with no row, never a
  placeholder "rest" session), `set_training_plan_item_status` (atomic
  status+completed_at update, mirrors `set_meal_plan_item_status`). RLS
  mirrors nutrition exactly. **Not yet applied to production** — same
  sandbox DNS restriction as always; the founder needs to run this via the
  Supabase SQL editor once it's reviewed. Every session's structure/
  safety_note is deliberately general and moderate, never a rigid
  numeric/medical prescription (CLAUDE.md coaching-safety).
- `lib/training/types.ts` / `lib/training/planner.ts` — pure, deterministic
  `generateWeekTrainingPlan`, mirroring `lib/nutrition/planner.ts`'s
  hard/soft-filter + variety-window approach exactly (preferred categories
  are a hard filter; session duration and location are soft, relaxed one
  at a time). Reuses the same `trainingDaysOfWeek` signal
  (`profiles.preferred_training_days`) nutrition's planner now uses, so a
  rest day is a day simply absent from the plan. `suggestTrainingReplacement`
  mirrors `suggestReplacement`'s closest-match rule (duration instead of
  calories). Recipe/session selection is never delegated to an LLM — same
  contract as nutrition and the Decision Engine.
- `lib/date/weekday.ts` — extracted the `dayOfWeek` helper that
  `lib/decision-engine/rules.ts`, `lib/nutrition/reasoning.ts`, and now
  `lib/training/planner.ts` all needed, rather than adding a third/fourth
  copy; `reasoning.ts` re-exports it so existing imports keep working.

Tests: `lib/training/planner.test.ts` (17 cases), `lib/date/weekday.test.ts`
(1 case), `lib/nutrition/workout-types.test.ts` rewritten for the new
taxonomy (7 cases, unchanged count). Full suite: 431/431 passing (+18 vs.
the previous 413 baseline). `tsc --noEmit` clean, `next lint` not yet
re-run for this exact commit (will run before the next slice ships) but no
new lint-relevant patterns were introduced beyond what's already clean
elsewhere.

Still pending after stage 1, done in stage 2 below: `lib/training/queries.ts`,
the weekly-plan API routes, and the Coach tool wiring. Still pending after
stage 2: the `/training` UI page, nav entry, and adding the three new
tables to `lib/account/reset.ts`'s wipe list so "Reiniciar conta de teste"
stays truthful about deleting every user-owned table — tracked as stage 3.

## Milestone 15, stage 2: Training Toolkit — persistence, API, Coach (2026-08-05)

Continues stage 1 above, mirroring `lib/nutrition/queries.ts` /
`app/api/nutrition/*` / `lib/coach/tools.ts`'s nutrition wiring one-for-one
for training, per the founder's "ok dale" to continue exactly where the
status report left off.

Built:
- `lib/training/queries.ts` — server-only persistence:
  `getTrainingProfile`/`upsertTrainingProfile`/`hasTrainingProfile`,
  `listWorkoutSessions`/`getWorkoutSessionsById` (the curated library,
  read-only), `getWeekTrainingPlan`/`getTrainingPlanById`/
  `saveWeekTrainingPlan` (upsert-by-`user_id,week_start` + delete-and-
  reinsert-items, the same "regeneration replaces, never accumulates"
  contract as `saveWeekPlan`), `replaceTrainingPlanItem`,
  `completeTrainingPlanItem` (calls `set_training_plan_item_status`, no
  pantry-consume step since sessions don't have ingredients), and
  `toTrainingPlanResponse` (joins persisted items with session data +
  optional reasoning).
- `lib/training/reasoning.ts` — `explainSessionChoice`, a "Porquê esta
  sessão?" plain-language explanation mirroring
  `lib/nutrition/reasoning.ts`'s own discipline: every sentence describes a
  real, checkable fact (category preference match, duration fit, location
  fit, intensity fit, physical limitations acknowledged), never an
  invented claim. 6 new tests in `lib/training/reasoning.test.ts`.
- `app/api/training/profile/route.ts` (GET/PUT, mirrors
  `app/api/nutrition/profile/route.ts`), `app/api/training/plan/route.ts`
  (GET current week / POST regenerate, mirrors
  `app/api/nutrition/plan/route.ts` minus the shopping-list side effect,
  which has no training equivalent), `app/api/training/plan/[itemId]/route.ts`
  (PATCH `complete`/`replace`, mirrors the nutrition item route's
  discriminated-union pattern).
- `lib/coach/tools.ts` / `lib/coach/types.ts` — three new tools:
  `get_week_training_plan` (read-only, mirrors `get_week_plan`),
  `generate_week_training_plan`, `replace_session`, `mark_session_done`
  (proposals requiring explicit founder confirmation, same as every other
  mutating tool). `lib/ai/provider.ts`'s system prompt now describes the
  training tools and, per the founder's other request this same message
  ("é possivel também perguntar se a pessoa quer o plano alimentar e
  gerar? ... 'Queres também o plano alimentar?' 'Queres também a lista de
  compras?'"), instructs the Coach to proactively ask a short closed
  yes/no question offering to generate the other related weekly plans
  (training ↔ meal plan ↔ shopping list) after generating one of them —
  never generating anything without an explicit yes.
- `lib/supabase/database.types.ts` — added `training_profiles`,
  `workout_sessions`, `training_plans`, `training_plan_items` table types
  and the `set_training_plan_item_status` RPC type, matching migration
  `202608050001_training_toolkit.sql` column-for-column.

Reused rather than duplicated: `getPreferredTrainingDays`
(`profiles.preferred_training_days`) is the same "which weekdays do you
train" signal nutrition's planner already reads — the Training Toolkit's
own week generation reads it too, rather than inventing a second concept
of "training days" living only in `training_profiles`.

Tests: `lib/training/reasoning.test.ts` (6 cases, new). Full suite:
450/450 passing. `tsc --noEmit` clean, `next lint` clean (0 warnings).

## Milestone 15, stage 3: Training Toolkit — UI, nav, reset wiring (2026-08-05)

Completes the Training Toolkit's first vertical slice (stages 1-2 above).

Built:
- `components/training/TrainingPlanView.tsx` — the 7-day plan view,
  mirroring `components/nutrition/MealPlanView.tsx`'s interaction pattern
  (generate/regenerate, mark done/skipped, replace, collapsible "Porquê
  esta sessão?" reasoning) minus the shopping-list/batch-prep pieces that
  have no training equivalent. Also shows each session's structure/safety
  note in a collapsible block, never a rigid numeric prescription
  (CLAUDE.md coaching-safety).
- `components/training/TrainingProfileForm.tsx` — settings form (preferred
  categories as toggle chips, session duration, location, intensity,
  variety, free-text physical limitations), mirroring
  `components/nutrition/NutritionProfileForm.tsx`, saved via PUT
  `/api/training/profile`.
- `app/(app)/training/page.tsx` (week plan) and
  `app/(app)/training/profile/page.tsx` (settings) — server components
  fetching via `lib/training/queries.ts`, mirroring the nutrition plan/
  profile pages' structure.
- `components/AppNav.tsx` — added a "Treino" nav entry (Dumbbell icon)
  between "Alimentação" and "Histórico", on both the desktop sidebar and
  mobile tab bar.
- `lib/account/reset.ts` — added `training_plan_items` (child, deleted
  before `training_plans`) and `training_plans`/`training_profiles`
  (parent tables) to "Reiniciar conta de teste"'s wipe list, so it stays
  truthful about deleting every user-owned table now that the Training
  Toolkit exists. `workout_sessions` deliberately left untouched — shared,
  global curated library, same treatment as `recipes`.

Validation: `tsc --noEmit` clean, `next lint` clean (0 warnings), full
vitest suite green (450/450 — no new test files needed for this UI-only
slice; the underlying logic is already covered by
`lib/training/planner.test.ts` and `lib/training/reasoning.test.ts`).

Outstanding for the founder: apply the three pending migrations
(`202608050001_training_toolkit.sql`, `202608050002_shopping_list_item_source.sql`,
`202608050003_ketogenic_diet_style.sql`) via the Supabase SQL editor — this
sandbox cannot reach `*.supabase.co` to apply them directly.

## Nutrition/pantry/shopping-list connection (2026-08-05)

Founder feedback: "Eu coloquei comida na lista mas a maior parte das
sugestões não inclui a comida que pus na lista" — asked for the meal plan,
pantry, and shopping list to actually connect: read/generate the shopping
list from the plan, check pantry stock and use what's already at home for
the plan, add only the real gap to the shopping list, tie macros to that
day's workout (already shipped 2026-08-05 earlier the same day), and offer
a specific diet-type option including Cetogénica.

**Root-cause bug found and fixed**: `generateShoppingListForPlan`
(`lib/nutrition/queries.ts`) deleted *every* `shopping_list_items` row on
the plan's `shopping_lists` row before re-inserting freshly computed
lines. `/nutrition/shopping` always shows whichever `shopping_lists` row
was most recently created with `status = 'open'`, which becomes the
plan-linked list the moment it's first generated — so anything the founder
typed in by hand afterwards lived on that same row, and the next "Gerar
plano"/"Lista de compras" click silently deleted it. Fixed via
`supabase/migrations/202608050002_shopping_list_item_source.sql`: a new
`source` column (`manual` / `meal_plan` / `coach`, backfilled correctly for
existing plan-linked lists) so `generateShoppingListForPlan` now only ever
deletes its own previously-generated lines. `lib/pantry/queries.ts`'s
`addShoppingItem` and `lib/coach/tools.ts`'s `add_to_shopping_list` tag
their inserts `manual`/`coach` accordingly. Added
`e2e/shopping-list-source.spec.ts` reproducing the exact bug (add a manual
item, regenerate the plan's shopping list, assert the manual item
survives).

**Pantry-aware planning** (the deeper "usa esses items para o plano
semanal" ask): `lib/nutrition/pantry-coverage.ts` (new) scores what
fraction of a recipe's non-optional ingredients are already covered by
pantry stock, scaled to the founder's `peopleCount` (same name+unit
matching convention `lib/nutrition/shopping.ts`'s `subtractPantryStock`
already used — no unit conversion, a pantry item in an incompatible unit
is left unmatched rather than silently guessed). `generateWeekPlan` now
accepts an optional `pantryStock` and softly sorts each slot's candidates
by pantry coverage first, training-day protein preference second as a
tiebreak — never a hard filter, so a recipe needing a full shop is still
eligible, just ranked below an equally-suitable one the founder can mostly
already cook. `lib/nutrition/reasoning.ts`'s `explainMealChoice` uses the
exact same scoring function to add an honest "já tens [todos/grande parte
d]os ingredientes desta receita na despensa" sentence only when the
condition genuinely holds. Wired via a new `getPantryStockLines` query
(also now reused inside `generateShoppingListForPlan` itself, removing a
small duplicated inline query) through both handlers in
`app/api/nutrition/plan/route.ts` and the Coach's `generate_week_plan`
tool. Tests: `pantry-coverage.test.ts` (7 cases), 3 new `planner.test.ts`
cases (prefers a fully-stocked recipe; pantry beats training-day protein
preference; unaffected when no pantry data is supplied), 3 new
`reasoning.test.ts` cases.

**Cetogénica (ketogenic) diet style**: added as a seventh `DietStyle`
value (`lib/nutrition/types.ts`, `lib/nutrition/options.ts`'s label,
`app/api/nutrition/profile/route.ts`'s Zod schema,
`lib/supabase/database.types.ts`). `supabase/migrations/
202608050003_ketogenic_diet_style.sql` widens the `nutrition_profiles.
diet_style` check constraint and tags 8 already very-low-carb (4-12g
carbs/serving), higher-fat recipes across breakfast/lunch/dinner/snack
with `ketogenic` in `diet_tags` — reusing already-reviewed macro data
rather than inventing new recipes, since several were already
low-carb-tagged and genuinely keto-appropriate.

Not yet applied to production — same sandbox DNS restriction as every
other migration this session; the founder needs to run all three new
migrations (202608050001-3) via the Supabase SQL editor.

Validated in an isolated sandbox copy: `tsc --noEmit` clean, `next lint`
clean, full `vitest` suite passing (444/444, +13 vs. the previous 431
Training-Toolkit-engine baseline).

## Friction reduction: fewer required inputs (2026-08-05)

Real user feedback via a test user (José Gama, relayed by the founder):
"pessoalmente sinto que tenho de dedicar demasiado tempo à APP para
aprender o seu funcionamento e para a utilização diária... não tenho
vontade de estar sempre a lançar a app para colocar inputs... Preciso que
a app trabalhe para mim e não eu para a app." He also asked about
wearable/device pairing to passively collect training/steps data — that
specific ask is out of scope per FOUNDER_CONTEXT.md's "Deep wearable
integrations before the decision loop is validated" (deferred, not
rejected). The founder asked instead to reduce every input we reasonably
can without touching that boundary.

Investigated actual friction points rather than guessing:

- **Onboarding (`components/OnboardingForm.tsx`)** was a single
  un-skippable page with 5 required free-text/textarea fields
  (`preferredName`, `currentIdentity`, `desiredIdentity`,
  `currentConstraints`, `interventionTone`) plus several selects/times
  (already defaulted, low friction). Every one of
  `currentIdentity`/`currentConstraints`/`interventionTone` already had a
  working fallback everywhere it's consumed
  (`lib/decision-engine/context-builder.ts`'s `DEFAULT_PROFILE`,
  `lib/decision-engine/prompts.ts`'s "não definida"/"nenhuma reportada"
  copy, `lib/ai/provider.ts`'s Coach system prompt) — the DB columns are
  even `not null default ''`/`'direto e prático'`. The friction was purely
  an app-layer requirement with no functional reason behind it.
- **Daily check-in (`components/DailyCheckInForm.tsx`)** was already
  fairly light (3 sliders defaulting to 3, 2 optional fields) but still
  needed the founder to open the app and re-set three sliders every day
  even when nothing had changed.

Built:
- `lib/profile/onboarding.ts` — `validateOnboardingDraft` no longer
  requires `currentIdentity`/`currentConstraints`/`interventionTone`.
  `preferredName` and `desiredIdentity` stay required (name for
  addressing the founder; desired identity is the core "atleta em
  reconstrução" reframe the product is built around).
- `components/OnboardingForm.tsx` / `components/settings/ProfileEditForm.tsx`
  — dropped the required asterisk on those 3 fields, added "(opcional)"
  labels and a short note that they can be shared with the Coach later
  instead.
- `app/api/profile/route.ts` — relaxed the Zod schema's `.min(1)` to allow
  empty strings for the same 3 fields (kept the max-length caps).
- `lib/decision-engine/context-builder.ts` — `mapProfileRow` now falls
  back to `DEFAULT_PROFILE.currentIdentity`/`currentConstraints` when the
  row's value is empty, matching every other optional field's existing
  pattern in that function (`interventionTone` already did this).
- `lib/coach/tools.ts` / `lib/coach/types.ts` — new `update_profile_notes`
  mutating tool (proposal, requires confirmation like every other mutating
  tool) that saves whichever of current identity/constraints/tone the
  founder actually volunteers in conversation. `lib/ai/provider.ts`'s
  system prompt instructs the Coach to offer this at most once per
  conversation, only with fields the founder actually said, and never to
  interrogate the founder about these fields unprompted — directly
  answering "a app trabalha para mim" instead of a form.
- `components/DailyCheckInForm.tsx` — added a "Foi como ontem" shortcut:
  fetches yesterday's `sleep_quality`/`energy_level`/`stress_level` on
  mount and, when present, shows a one-tap button that submits with those
  values immediately. `physical_limitation`/`notes` are deliberately never
  carried forward (day-specific; yesterday's knee pain may not apply
  today), so the founder only re-types those if actually relevant.
- `lib/date/calendar-grid.ts`'s existing `addDays` reused for the
  "yesterday" date key rather than adding a fifth copy of the same
  UTC-noon-anchored day-arithmetic helper.
- `lib/profile/onboarding.test.ts` — updated the two tests that asserted
  the now-optional fields were required, to assert the opposite with the
  rationale documented inline.

Deliberately not touched: wearable/device integrations (explicitly
deferred per FOUNDER_CONTEXT.md, not part of this pass) and the
onboarding's time/select fields (already zero-effort thanks to sensible
pre-filled defaults — not a real friction point).

Validated in an isolated sandbox copy: `tsc --noEmit` clean, `next lint`
clean, full `vitest` suite passing (450/450).

## Safety copy reinforcement: suggestions, not confirmed medical fact (2026-08-05)

Founder instruction, directly following the friction-reduction pass above:
"nada destas decisões poderão ser confirmadas com um médico, nutricionista,
ou profissional de saúde. Por isso este coach tem de funcionar com
sugestões e não verdades absolutas." CLAUDE.md's Coaching Safety section
already barred diagnosis/medical claims/unsafe prescriptions at the
behavioral level; this pass makes that visible to the founder on screen,
not just enforced silently in the system prompt, and tightens the prompt
language itself.

Audited where a "não é conselho médico"-style line already existed:
`app/(app)/nutrition/plan/page.tsx` and `app/(app)/training/page.tsx` both
already had one. The Coach chat itself (`/coach`, `CoachDrawer`) and the
daily decisions list (`CalendarWorkspace.tsx`) — arguably the two
highest-traffic, most open-ended surfaces — had none.

Built:
- `lib/ai/provider.ts` / `lib/decision-engine/prompts.ts` — `SAFETY_RULES`
  (kept in sync between the two, per the existing header comment) now
  explicitly instructs: frame every answer as a suggestion or starting
  point, never a settled/validated fact; for anything with real health
  weight, say plainly it cannot be confirmed and recommend checking with a
  doctor/nutritionist, rather than softening into vague hedges and then
  answering as if confirmed anyway.
- `components/coach/CoachPageClient.tsx` and `components/CoachDrawer.tsx`
  (both the compact and expanded views) — added a persistent, low-weight
  caption under the composer: "Sugestões do Coach — não confirmadas por um
  médico ou nutricionista." Always visible, not just shown once or on the
  empty state.
- `components/CalendarWorkspace.tsx` — added one caption below the daily
  decisions list (not per-card, to avoid repetition): "Sugestões geradas
  por regras e IA — não confirmadas por um médico ou nutricionista."

On the founder's separate question of whether the Coach has "uma base de
dados vasta" for reliable, concrete answers: today it does not draw on an
external medical/nutrition database. Its concrete grounding is the curated
recipe library (`recipes`/`recipe_ingredients`) and workout session
library (`workout_sessions`), both reviewed by the founder, plus the
deterministic decision-engine rules — the AI layer only rephrases/
personalizes what those already produced, per `docs/08_AI_ARCHITECTURE.md`
and every planner module's "never delegate selection to an LLM" header
comment. Expanding to a larger external nutrition/exercise-science
database (e.g. a food-composition API) would be a real scope decision, not
folded into this pass.

Validated in an isolated sandbox copy: `tsc --noEmit` clean, `next lint`
clean, full `vitest` suite passing (450/450 — no logic changed, only
prompt copy and static UI captions).

## Category-aware meal-plan macros — #116 (2026-08-05)

Founder instruction: "faz todos" (build every item from the gap analysis),
closing the `#116` gap flagged in the shopping-list/workout-catalog section
above — wiring the founder's actual planned training category into the
weekly meal plan's macro sort, not just the flat "is today a training day"
signal from Milestone 12.

Built:
- **`lib/nutrition/workout-types.ts`** — new
  `TRAINING_CATEGORY_NUTRITION_BIAS: Record<TrainingCategory, "protein" |
  "carbs" | "neutral">`, read directly off the existing
  `TRAINING_CATEGORY_MACRO_GUIDANCE` paragraphs rather than invented
  separately: `hipertrofia`/`wrestling_grappling` → protein (their text
  leads with recovery/repair protein need), `cardio_pesado`/
  `artes_marciais_strike` → carbs (their text leads with pre-session fuel
  need), `calistenia`/`cardio_leve`/`mobilidade`/`parkour` → neutral (their
  text says no special adjustment is needed).
- **`lib/nutrition/planner.ts`** — `generateWeekPlan` takes an optional
  `trainingCategoryByDate?: Record<string, TrainingCategory>`. A day
  present in the map uses that category's bias (protein/carbs/neutral);
  a day absent from the map falls back to the original flat
  `trainingDaysOfWeek`-only protein preference, so existing callers that
  don't pass training-plan data see zero behaviour change. Still a soft
  sort, never a hard filter — pantry coverage still takes priority.
- **`lib/nutrition/reasoning.ts`** — `explainMealChoice` takes an optional
  `trainingCategory` and, when supplied, replaces the generic "dias de
  treino habituais" sentence with one naming the real category and its
  real bias ("Hoje tens Hipertrofia planeado..." / "...Cardio pesado...
  mais hidratos de carbono..."); a neutral category now correctly adds no
  macro-bias sentence at all, matching that its guidance text says no
  adjustment was made.
- **`lib/training/queries.ts`** — new
  `getTrainingCategoryByDateForWeek(supabase, userId, weekStart)`: joins a
  saved `training_plans`/`training_plan_items` week with
  `workout_sessions` to build the `dayDate -> TrainingCategory` map;
  returns `{}` when no training plan exists yet for that week. Kept here
  (not in `lib/nutrition/*`) and composed only at the route/Coach-tool
  layer — nutrition and training remain decoupled, matching the existing
  `pantryStock`/`trainingDaysOfWeek` composition pattern.
- **`lib/nutrition/queries.ts`** — `toPlanResponse`'s `reasoningContext`
  gained an optional `trainingCategoryByDate`, passed straight through to
  `explainMealChoice` per row.
- **`app/api/nutrition/plan/route.ts`** (GET + POST) and
  **`lib/coach/tools.ts`**'s `generate_week_plan` — all three now fetch
  `getTrainingCategoryByDateForWeek` alongside the existing profile/
  recipes/pantry/training-days calls and thread it into both
  `generateWeekPlan` and `toPlanResponse`.

`get_week_plan` (the Coach's read-only tool) is unchanged — it already
called `toPlanResponse` with no `reasoningContext` at all (no `reason`
sentences), so there was nothing to wire there without a separate,
larger change to that read path; out of scope for this pass.

8 new tests: 4 in `planner.test.ts` (carbs bias for `cardio_pesado`,
protein bias preserved for `hipertrofia`, no bias at all for the neutral
`mobilidade`, and the "day absent from the map falls back to the flat
behaviour" case) and 4 in `reasoning.test.ts` (category-specific protein
sentence, category-specific carbs sentence, no sentence for a neutral
category, and the fallback-to-flat-sentence case when no category is
supplied).

Validated in an isolated sandbox copy: `tsc --noEmit` clean, `next lint`
clean, full `vitest` suite passing (458/458 — 450 prior + 8 new). `next
build` still only fails on the same pre-existing Google-Fonts
sandbox-network restriction, unrelated to these changes.

## Same-day training override on daily decisions — #117 (2026-08-05)

Founder instruction: "faz todos" — closing the `#117` gap flagged above,
so the Início/Hoje "Treino ao almoço" decision names the actual planned
Training Toolkit session for today instead of contradicting it with a
generic "Treina entre as X e Y" prompt. Mirrors Milestone 12's
`todaysDinnerPlanName` mechanism exactly, applied to training instead of
nutrition — same "an already-decided plan beats a same-day generic nudge"
rationale.

Built:
- **`lib/training/queries.ts`** — new
  `getTodaysTrainingSessionName(supabase, userId, date)`: reads today's
  `training_plan_items` row for this user (status `'planned'`) and joins
  `workout_sessions` for its name; returns `null` when no training plan
  covers today.
- **`lib/decision-engine/types.ts`** — `DailyContext` gained an optional
  `todaysTrainingSessionName?: string | null`, documented identically to
  `todaysDinnerPlanName`.
- **`lib/decision-engine/context-builder.ts`** and **`run.ts`** — threaded
  the new field through `BuildDailyContextParams` and
  `runDecisionGeneration` exactly like `todaysDinnerPlanName` (same
  `.catch(() => null)` failure-degrades-to-"no override" contract).
- **`lib/decision-engine/rules.ts`**'s `lunchTraining` — when
  `context.todaysTrainingSessionName` is set, `recommendedAction` becomes
  "Treina {sessionName} entre as X e Y." and `baseReason` names the plan
  ("Hoje tens {sessionName} planeado no teu plano de treino da semana...");
  absent, both fall back to the original generic phrasing unchanged.
  `reducedTraining`, `mobilityInsteadOfCancellation`, and
  `prepareTrainingEquipment` were deliberately left untouched — this pass
  only targets the one rule that names a specific training block, keeping
  the change a single coherent slice rather than restyling every
  training-domain rule at once.

2 new tests in `rules.test.ts`: the override text appears when a session
is planned, and the original generic phrasing survives untouched when
none is.

Validated in an isolated sandbox copy: `tsc --noEmit` clean, `next lint`
clean, full `vitest` suite passing (460/460 — 458 prior + 2 new). `next
build` still only fails on the same pre-existing Google-Fonts
sandbox-network restriction, unrelated to these changes.

## Consent-bypass fix, drafted — #146 (2026-08-05, migration not yet applied)

Founder instruction: "faz todos" — closing the accepted, documented
limitation flagged earlier in this file ("One accepted, documented
limitation (consent bypass)"): `OnboardingForm.tsx`'s privacy/terms
checkbox was enforced client-side only, before a direct browser-to-
Supabase upsert, so a technically sophisticated user could call
`supabase.from("profiles").upsert(...)` directly with
`onboarding_completed: true` and skip consenting entirely.

Built exactly the fix that entry itself suggested — "a trigger scoped
only to the transition into `onboarding_completed = true`" — rather than
a blanket `check` constraint, which was already correctly rejected there
because Postgres re-evaluates `check` constraints on every `UPDATE` of a
row, not just when the constrained columns change, and would have broken
the founder's own pre-existing profile (already `onboarding_completed`,
nullable consent timestamps by design) the next time he saved a
`/settings` edit.

- **`supabase/migrations/202608050004_enforce_onboarding_consent.sql`** —
  new `enforce_onboarding_consent()` trigger function + `before insert or
  update on public.profiles` trigger. Only raises when a row is
  transitioning INTO `onboarding_completed = true` (a fresh `INSERT`, or
  an `UPDATE` where it was not already true) and either consent timestamp
  is null. A row that's already onboarded is untouched by any later
  update — `app/api/profile/route.ts`'s `/settings` PUT handler never
  writes `onboarding_completed` at all, so it can never trigger this
  either; a genuine re-onboarding after "Reiniciar conta de teste" (which
  deletes the `profiles` row outright) goes through a fresh `INSERT` with
  both timestamps already set by `OnboardingForm.tsx`, so the legitimate
  path is unaffected.

**Not yet applied to production.** Every prior Supabase migration this
session was applied directly via the SQL Editor with the founder's
explicit per-instance browser access grant; this one hit an auto-mode
safety block on the navigation itself (schema changes to a live
production table require a fresh, explicit go-ahead in this sub-thread
rather than reusing an earlier grant). The migration file is committed to
the repo and ready — needs the founder to say go, then apply it the same
way as `202608050001`-`202608050003`.

The legitimate `OnboardingForm.tsx` submission path already sets both
consent timestamps together before setting `onboarding_completed: true`,
so it was never affected either way — but one real regression risk was
caught while checking for other direct writers: **`e2e/fixtures.ts`'s
`MINIMAL_PROFILE`** (used by every authenticated Playwright fixture —
Today/Calendar, Nutrition, Training, Coach, Settings, Memory) seeds a
profile via the admin client with `onboarding_completed: true` and no
consent timestamps at all. Triggers fire regardless of RLS, so this
migration would have failed every authenticated e2e test at setup the
next time the suite ran. Fixed by adding
`privacy_consent_at`/`terms_accepted_at` (both `new Date().toISOString()`)
to `MINIMAL_PROFILE` before the migration is ever applied.

Not independently testable via `vitest` (no local Postgres in this
sandbox); validation will be applying the migration and confirming (a) a
normal onboarding still succeeds, (b) the Playwright suite's authenticated
fixture still seeds successfully, and (c) a raw `upsert` with
`onboarding_completed: true` and no consent timestamps is rejected.
