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

## After the pilot validates

Not started until the calendar-aware decision loop is proven for the founder:

- `PRODUCT_BACKLOG.md` (repo root) / `REBUILD_MASTER_HANDOFF.md` §10 — Nutrition Toolkit module, explicitly deferred.
- Identity progression levels (Restart → Momentum → Competitor → Athlete → Mentor).
- Learned/adaptive prediction, once there is enough logged decision-outcome data to evaluate it against the deterministic rules baseline.

## Explicitly not on any near-term roadmap

Calorie/macro tracking, food databases, recipe generation, food photo recognition, barcode scanning, wearable integrations (Apple Health, Garmin, Xiaomi, Fitbit), location tracking, social/community features, large achievement systems, a full calendar replacement, native mobile apps, advanced predictive ML.
