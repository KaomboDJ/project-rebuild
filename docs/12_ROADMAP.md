# 12 — Roadmap

## Calendar privacy hardening — 2026-08-11

Per-calendar availability-only defaults, optional title/location context, provider field minimization
and separate Google read/write authorization are implemented in the current hardening slice. This is
a privacy correction inside the existing unified-calendar scope, not a new product module. Details:
`docs/23_CALENDAR_PRIVACY.md`.

Local release gates are green (type-check, lint, 468 unit tests and production build); the additive
production migration is applied and verified. PR browser/CI validation is the remaining release gate.

## Phase 1 completion authorization — 2026-08-03

The founder froze the first product phase around five capabilities: unified
calendar, notifications, nutrition finish, application guide and
identity-based gamification, plus the sleep-window safety correction required
to prevent inappropriate overnight suggestions. The implementation and exact
non-goals are in `docs/19_PHASE_1_HEALTH_COMPLETION.md`. Historical pilot and
milestone notes below remain provenance; they no longer gate this explicitly
authorized completion release.

`REBUILD_MASTER_HANDOFF.md` §26 defines the authoritative milestone sequence for the current MVP — this file summarizes it and points to live status. If the two ever disagree, the handoff wins; correct this file.

Last updated: 2026-07-30, after the pre-pilot stabilization sprint (see `PROJECT_REBUILD_STATE.md`). All eight original MVP milestones are done; the current phase is validating the product with real usage, not building new modules.

## Milestones (all done)

1. **Foundation** — Supabase Auth (magic link), route protection, app shell, database migrations with RLS, `.env.example`, environment validation.
2. **Onboarding** — onboarding form persists directly to `profiles` (identity, timezone, objective, training days, key times, constraints, tone), replacing the old localStorage bridge.
3. **Google Calendar** — OAuth connect/callback/disconnect, encrypted token storage (AES-256-GCM), token refresh, today's/range's events read, timezone-aware `[timeMin, timeMax)` queries.
4. **Deterministic Decision Engine** — context builder, 14-rule catalog, scoring, diversity-constrained selection of exactly three decisions, persistence, regeneration without duplicate runs, AI refinement layer (Anthropic, ranking/rewriting only, never selecting).
5. **Decision interaction** — accept/edit/complete/skip, explicit "Útil / Não útil" feedback per decision, a real `/history` page grouped by day.
6. **Calendar intervention** — "Adicionar ao calendário" creates a Google Calendar event for an accepted/edited decision with a time window; event id stored on the decision row to prevent duplicates.
7. **AI refinement** — provider abstraction (`lib/ai/provider.ts`), structured/Zod-validated output, deterministic fallback on any AI failure or invalid output.
8. **PWA and Vercel** — installable manifest (`app/manifest.ts`), app icons, minimal service worker, responsive layout, production deployment. Vercel auto-deploys `main`, live at `https://project-rebuild-chi.vercel.app`.

Live, per-item detail and validation history is in `IMPLEMENTATION_STATUS.md` — check that file before assuming what already exists.

**Auth UX Hardening milestone (2026-07-31, merged to `main` 2026-08-01)**: Milestone 1's original "Supabase Auth (magic link)" line above describes what was originally built, but is no longer the current primary experience. The invited-alpha hierarchy is Google OAuth (primary and operational, using a dedicated identity OAuth client) → Microsoft OAuth (feature-flagged, hidden until configured) → email one-time code (implemented but feature-flagged off until custom SMTP and a real token template are inbox-tested). Privacy/terms, explicit wellbeing-data consent, self-service data export, accurate processor disclosure, and standard browser security headers are included. The cross-account data-isolation suite (`e2e/cross-account-isolation.spec.ts`, 24 tests) initially couldn't execute because of a CI Node-version incident (Node 20 vs. the native `WebSocket` global `@supabase/supabase-js` needs, only present from Node 22) — root-caused, fixed (CI now pins Node 22), and re-run to a fully green result: static/unit/build, Playwright (82 passed / 6 correctly-skipped `@live-email` / 0 failed), Axe, and all 24 isolation tests green on GitHub's own infrastructure. See `IMPLEMENTATION_STATUS.md`'s "CI incident, root cause, and final green pass (2026-08-01)" for the full detail.

## Current phase: Founder Pilot (14 days)

Per `PROJECT_REBUILD_STATE.md`: the technical loop is complete (auth → onboarding → calendar → three daily decisions → action → history). The open question isn't "what else to build" — it's whether the app measurably improves real decisions for the founder. The pilot is a usage-and-measurement period, not an engineering phase; no new modules ship during it unless the pilot itself surfaces a blocking bug.

Advancement criterion after the 14 days: if the loop demonstrates value, move to Nutrition Toolkit v0.1 (see `PRODUCT_BACKLOG.md`). If not, improve timing/rules/relevance of the existing engine before adding anything. Learned/adaptive prediction (ML) stays deferred either way — there isn't enough logged decision-outcome data yet to evaluate it against the deterministic baseline.

**One-time founder-approved exception (2026-07-30):** the founder proposed a Coach UX rework plus a pantry/shopping-list module mid-pilot, was shown that this conflicts with the "no new modules" rule above, and explicitly chose to override it for this milestone rather than wait ("Avançar já, atualizar a governance" — see `PROJECT_REBUILD_STATE.md`'s governance note). What shipped under this exception: a three-state Coach UX (compact drawer / expanded drawer / full `/coach` page) with persisted conversation history and Markdown rendering; `pantry_items` / `inventory_events` / `shopping_lists` / `shopping_list_items` with RLS and an append-only inventory ledger; manual pantry/shopping CRUD at `/nutrition`, `/nutrition/pantry`, `/nutrition/shopping`; and Coach tool-calling against pantry/shopping state (`get_inventory`, `consume_item`, `adjust_inventory`, `add_to_shopping_list`, `mark_item_purchased`, `suggest_available_meal`, `record_meal`) gated behind explicit user confirmation for every mutation. The full Nutrition Toolkit (`PRODUCT_BACKLOG.md` — meal plans, macro estimates, recipe-driven shopping lists) was explicitly *not* built under this exception and remains gated on pilot validation, same as before. The "no new modules" rule still applies by default to anything proposed after this — this was a specific, informed, one-off decision, not a standing precedent.

## UX Hardening release (2026-07-31)

A focused hardening pass built directly from `docs/17_UX_AUDIT.md` (see that file's §18 for per-issue resolution status, and `docs/IMPLEMENTATION_STATUS.md` for validation/deployment status) — fixes to already-specified or already-built behavior (profile editing, keyboard focus order, pantry count consistency, drawer accessibility, copy/i18n, a lightweight contextual-help foundation, account deletion, a new Playwright suite), not new product scope, so this doesn't conflict with the Founder Pilot's "no new modules" rule any more than a bug-fix would. On branch `ux-hardening-release`, not yet pushed/merged/deployed (see `docs/IMPLEMENTATION_STATUS.md`'s note on why, from this build environment).

## After the pilot validates

Not started until the calendar-aware decision loop is proven for the founder — **superseded for Milestones 11-14 by the full roadmap authorization below**, which explicitly moves these items from "after the pilot validates" to "authorized now, sequenced with check-ins":

- `PRODUCT_BACKLOG.md` (repo root) / `REBUILD_MASTER_HANDOFF.md` §10 — Nutrition Toolkit module, explicitly deferred.
- Identity progression levels (Restart → Momentum → Competitor → Athlete → Mentor) — still not authorized; not part of Milestones 10-14.
- Learned/adaptive prediction — authorized as Milestone 14, still bound by its own acceptance criteria (deterministic cold start, minimum evidence thresholds, no opaque scoring) rather than started ahead of real data existing.

## Full roadmap authorization — 2026-07-30

The founder explicitly authorized Milestones 10-14 below, overriding the Founder Pilot's "no new modules" rule for these specifically (see `PROJECT_REBUILD_STATE.md`'s matching governance note for the confirmation exchange). Execution mode through Milestone 11A: **milestone by milestone, with a check-in after each** — each milestone got its own validation pass, its own commit(s), and its own explicit go-ahead before any production migration, branch merge, or Vercel production deploy.

**Update — 2026-07-30, after 11A shipped:** the founder lifted the per-milestone go-ahead requirement ("go through all of them... implement them all") — see `PROJECT_REBUILD_STATE.md`'s matching governance note. Milestones 11B-14 proceed continuously: still one coherent vertical slice at a time, still validated and documented as each lands, but without pausing for a fresh go-ahead before each production step.

| # | Milestone | Status |
|---|---|---|
| 10 | Review and release Coach UX + Pantry Intelligence | Done. Build, validation, and live smoke test complete (see `docs/IMPLEMENTATION_STATUS.md`); production migrations applied; two bugs found in smoke test (chat truncation, empty message bubble) fixed and re-verified on Preview. Founder said "Go forward" (2026-07-30); merged `calendar-workspace` → `main` (`80cf067`, fast-forward) and confirmed Ready on Vercel Production. |
| 11 | Daily Planning Engine ("Programar o meu dia") — multi-account Google Calendar (11A), planning workflow (11B), calendar-aware meal recommendation (11C), pantry/consumption/shopping integration (11D) | **Done — all four sub-slices shipped.** 11A: multi-account Google Calendar, production migration applied, merged to `main` (`3f0daec`). 11B: batch "Programar o meu dia" planning action, no schema change, merged (`61aadc3`). 11C: nutrition rules name a specific at-home pantry item, no schema change, merged (`6225790`). 11D: completing a nutrition decision that named a pantry item now auto-consumes it (`decisions.related_pantry_item`, new RPC-backed helper), production migration applied, merged to `main` (`3d8741c`), confirmed Ready on Vercel Production (see `docs/IMPLEMENTATION_STATUS.md`). |
| 12 | Complete Nutrition Toolkit (profile, recipe/food library, 7-day planner, shopping list, meal execution, Coach integration) | **Done.** Nutrition profile, 24-recipe curated library, deterministic 7-day planner, meal replacement, meal execution with pantry auto-consume, shopping-list generation, macro estimates, Decision Engine dinner-plan priority, 4 new Coach tools. Migration applied to production. See `docs/13_NUTRITION_TOOLKIT.md` / `docs/IMPLEMENTATION_STATUS.md`. Committed (`milestone-12-nutrition-toolkit` branch) — push to `main` pending GitHub 2FA approval. |
| 13 | Automation and continuous synchronization (incremental Calendar sync, proactive interventions, replanning, daily briefings) | **Operational in production.** Cron-driven proactive decision generation + calendar-drift flagging + daily briefings, live behind `CRON_SECRET`. Production activation verified 2026-07-30/31: auth rejection, successful execution, idempotent re-run, and correct DB effects all confirmed; a pre-existing `service_role` grants gap (not introduced by this milestone) was found and fixed during activation. See `docs/14_AUTOMATION.md` / `docs/IMPLEMENTATION_STATUS.md`. |
| 14 | Learning and personalization (outcome logging, interpretable pattern engine, personalized intervention selection, user-visible/editable memory) | **Done.** `decisions.rule_id` join key, pure pattern engine with a `MIN_EVIDENCE_COUNT`/`MAX_PERSONALIZATION_ADJUSTMENT`-bounded scoring nudge, absolute rule muting, founder-authored notes (general + rule-scoped, folded into the Coach prompt), `/settings/memory` UI. See `docs/15_LEARNING_PERSONALIZATION.md` / `docs/IMPLEMENTATION_STATUS.md`. Committed — migration and push pending, same as 12/13. |

This table is the live tracker referenced above; update it as each milestone starts/finishes rather than duplicating status prose in multiple places.

## Daily Home + Decisions UX recovery — 2026-08-01

**Status: release gates green on `codex/daily-home-recovery`; production migration applied and verified; tracked in PR #5.**

This founder-requested UX slice introduces `/home` as the impactful authenticated entry point and gives Home sole ownership of day planning/confirmation. `/today` remains the Decisions execution and feedback workspace. Structured timing (`calendar_slot`, `trigger_based`, `flexible`), deterministic free-slot selection, conflict revalidation and explicit confirmation fix the root cause of the previously disabled “Programar o meu dia” action. Full specification and validation evidence: `docs/18_HOME_AND_DECISIONS.md`.

Release evidence: migration `202608010001_daily_home_timing.sql` is present in Production; CI run #29 passed lint, type-check, 317/317 unit tests, production build and the real browser suite (84 passed, 6 correctly skipped live-email cases, 0 failed), including Axe with zero detected WCAG A/AA violations and all 24 cross-account isolation checks.

## Explicitly not on any near-term roadmap

Food photo recognition, barcode scanning, wearable integrations (Apple Health, Garmin, Xiaomi, Fitbit), location tracking, social/community features, large achievement systems, a full calendar replacement, native mobile apps, identity progression levels. (Calorie/macro tracking, food databases/recipes, and advanced predictive ML were on this list before the 2026-07-30 full roadmap authorization above moved them into Milestones 12 and 14 specifically — they are authorized only in the scoped form described there, not as a general invitation to build adjacent features.)
