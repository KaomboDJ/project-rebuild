# 12 — Roadmap

`REBUILD_MASTER_HANDOFF.md` §26 defines the authoritative milestone sequence for the current MVP — this file summarizes it and points to live status. If the two ever disagree, the handoff wins; correct this file.

## Milestones

1. **Foundation** — repo inspection, docs, Next.js/TS/Tailwind validation, Supabase client utilities, database migrations, authentication foundation, application shell, `.env.example`, environment validation. *Near complete — see `IMPLEMENTATION_STATUS.md`.*
2. **Onboarding** — onboarding interface, Supabase profile persistence, timezone handling, settings basics, redirect logic. *Not started; onboarding still runs on the Milestone-1-era localStorage bridge.*
3. **Google Calendar** — OAuth connect/callback, secure token storage, refresh, calendar selection, today's events, normalization, free-window calculation, disconnection. *Not started.*
4. **Deterministic Decision Engine** — context builder, rule generation, scoring, diversity constraints, conflict prevention, exactly three decisions, persistence, regeneration, duplicate-run prevention. *Not started; design documented in `06_DECISION_ENGINE.md`/`07_DECISION_CATALOG.md`.*
5. **Decision interaction** — decision cards, accept/edit/complete/skip, feedback, history, XP. *Not started (beyond the old local-only slice's simpler version).*
6. **Calendar intervention** — Add to Calendar, event creation with popup reminder, event metadata, duplicate prevention, calendar event ID persistence. *Not started.*
7. **AI refinement** — provider abstraction, structured output, ranking/rewriting, deterministic fallback, prompt versioning. *Not started; design documented in `08_AI_ARCHITECTURE.md`. Distinct from the existing, already-working `lib/ai/provider.ts` Decision Coach.*
8. **PWA and Vercel** — manifest, responsive layout, production configuration, deployment validation, final tests. *Vercel deployment itself is already live (`https://project-rebuild-chi.vercel.app`); PWA manifest not yet added.*

Live, per-item status is in `IMPLEMENTATION_STATUS.md` — that file is the one to check before assuming what already exists; this file only defines order and scope.

## After this MVP validates

Not started until the calendar-aware decision loop is proven for the founder:

- `PRODUCT_BACKLOG.md` (repo root) / `REBUILD_MASTER_HANDOFF.md` §10 — Nutrition Toolkit module, explicitly deferred.
- Identity progression levels (Restart → Momentum → Competitor → Athlete → Mentor).
- Learned/adaptive prediction, once there is enough logged decision-outcome data to evaluate it against the deterministic rules baseline.

## Explicitly not on any near-term roadmap

Calorie/macro tracking, food databases, recipe generation, food photo recognition, barcode scanning, wearable integrations (Apple Health, Garmin, Xiaomi, Fitbit), location tracking, social/community features, large achievement systems, a full calendar replacement, native mobile apps, advanced predictive ML.
