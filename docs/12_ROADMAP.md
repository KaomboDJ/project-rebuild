# 12 — Roadmap

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

## Current phase: Founder Pilot (14 days)

Per `PROJECT_REBUILD_STATE.md`: the technical loop is complete (auth → onboarding → calendar → three daily decisions → action → history). The open question isn't "what else to build" — it's whether the app measurably improves real decisions for the founder. The pilot is a usage-and-measurement period, not an engineering phase; no new modules ship during it unless the pilot itself surfaces a blocking bug.

Advancement criterion after the 14 days: if the loop demonstrates value, move to Nutrition Toolkit v0.1 (see `PRODUCT_BACKLOG.md`). If not, improve timing/rules/relevance of the existing engine before adding anything. Learned/adaptive prediction (ML) stays deferred either way — there isn't enough logged decision-outcome data yet to evaluate it against the deterministic baseline.

**One-time founder-approved exception (2026-07-30):** the founder proposed a Coach UX rework plus a pantry/shopping-list module mid-pilot, was shown that this conflicts with the "no new modules" rule above, and explicitly chose to override it for this milestone rather than wait ("Avançar já, atualizar a governance" — see `PROJECT_REBUILD_STATE.md`'s governance note). What shipped under this exception: a three-state Coach UX (compact drawer / expanded drawer / full `/coach` page) with persisted conversation history and Markdown rendering; `pantry_items` / `inventory_events` / `shopping_lists` / `shopping_list_items` with RLS and an append-only inventory ledger; manual pantry/shopping CRUD at `/nutrition`, `/nutrition/pantry`, `/nutrition/shopping`; and Coach tool-calling against pantry/shopping state (`get_inventory`, `consume_item`, `adjust_inventory`, `add_to_shopping_list`, `mark_item_purchased`, `suggest_available_meal`, `record_meal`) gated behind explicit user confirmation for every mutation. The full Nutrition Toolkit (`PRODUCT_BACKLOG.md` — meal plans, macro estimates, recipe-driven shopping lists) was explicitly *not* built under this exception and remains gated on pilot validation, same as before. The "no new modules" rule still applies by default to anything proposed after this — this was a specific, informed, one-off decision, not a standing precedent.

## After the pilot validates

Not started until the calendar-aware decision loop is proven for the founder — **superseded for Milestones 11-14 by the full roadmap authorization below**, which explicitly moves these items from "after the pilot validates" to "authorized now, sequenced with check-ins":

- `PRODUCT_BACKLOG.md` (repo root) / `REBUILD_MASTER_HANDOFF.md` §10 — Nutrition Toolkit module, explicitly deferred.
- Identity progression levels (Restart → Momentum → Competitor → Athlete → Mentor) — still not authorized; not part of Milestones 10-14.
- Learned/adaptive prediction — authorized as Milestone 14, still bound by its own acceptance criteria (deterministic cold start, minimum evidence thresholds, no opaque scoring) rather than started ahead of real data existing.

## Full roadmap authorization — 2026-07-30

The founder explicitly authorized Milestones 10-14 below, overriding the Founder Pilot's "no new modules" rule for these specifically (see `PROJECT_REBUILD_STATE.md`'s matching governance note for the confirmation exchange). Execution mode: **milestone by milestone, with a check-in after each** — not one unattended run through production. Each milestone gets its own validation pass, its own commit(s), and its own explicit go-ahead before any production migration, branch merge, or Vercel production deploy.

| # | Milestone | Status |
|---|---|---|
| 10 | Review and release Coach UX + Pantry Intelligence | Done. Build, validation, and live smoke test complete (see `docs/IMPLEMENTATION_STATUS.md`); production migrations applied; two bugs found in smoke test (chat truncation, empty message bubble) fixed and re-verified on Preview. Founder said "Go forward" (2026-07-30); merged `calendar-workspace` → `main` (`80cf067`, fast-forward) and confirmed Ready on Vercel Production. |
| 11 | Daily Planning Engine ("Programar o meu dia") — multi-account Google Calendar (11A), planning workflow (11B), calendar-aware meal recommendation (11C), pantry/consumption/shopping integration (11D) | Not started |
| 12 | Complete Nutrition Toolkit (profile, recipe/food library, 7-day planner, shopping list, meal execution, Coach integration) | Not started |
| 13 | Automation and continuous synchronization (incremental Calendar sync, proactive interventions, replanning, daily briefings) | Not started |
| 14 | Learning and personalization (outcome logging, interpretable pattern engine, personalized intervention selection, user-visible/editable memory) | Not started |

This table is the live tracker referenced above; update it as each milestone starts/finishes rather than duplicating status prose in multiple places.

## Explicitly not on any near-term roadmap

Food photo recognition, barcode scanning, wearable integrations (Apple Health, Garmin, Xiaomi, Fitbit), location tracking, social/community features, large achievement systems, a full calendar replacement, native mobile apps, identity progression levels. (Calorie/macro tracking, food databases/recipes, and advanced predictive ML were on this list before the 2026-07-30 full roadmap authorization above moved them into Milestones 12 and 14 specifically — they are authorized only in the scoped form described there, not as a general invitation to build adjacent features.)
