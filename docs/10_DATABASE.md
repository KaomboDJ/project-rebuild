# 10 — Database

Supabase Postgres. This document describes the schema as actually implemented in `supabase/migrations/202607290001_foundation.sql` — the migration file is the source of truth; correct this document if they ever drift, not the other way around.

Row Level Security is enabled on every table. `calendar_connections` has RLS enabled with **no policies granted to `anon`/`authenticated`** — service-role access only, from Route Handlers, since it holds OAuth tokens.

## `profiles`

One row per user (`user_id` unique, FK → `auth.users.id`; `id` is its own primary key, not the user id). Onboarding fields: `preferred_name`, `timezone` (default `Europe/Lisbon`), `current_identity`, `desired_identity`, `primary_objective` (check-constrained to `rebuild-fitness`/`lose-weight`/`train-consistently`/`improve-nutrition`/`improve-sleep`), `preferred_training_days` (`text[]`), `preferred_training_time`/`typical_dinner_time`/`target_sleep_time` (`"HH:MM"`, check-constrained by regex), `working_hours` (`jsonb`, default `{"start":"09:00","end":"18:00"}`), `current_constraints`, `intervention_tone`, `onboarding_completed`. RLS: owner-only select/insert/update/delete via `auth.uid() = user_id`.

## `calendar_connections`

`user_id` (FK), `provider` (currently only `'google'`), `encrypted_access_token`, `encrypted_refresh_token`, `expires_at`, `scopes` (`text[]`), `calendar_id` (default `primary`). **No grants to `anon`/`authenticated`** — this table is only ever touched via the service-role client (`lib/supabase/admin.ts`) inside Route Handlers, never from a Server/Client Component's user-scoped client.

Since Milestone 11A (`supabase/migrations/202607300005_multi_account_calendar.sql`) a user can have more than one connected Google account: the original `unique(user_id, provider)` was dropped in favor of `unique(user_id, provider, google_account_email)` (prevents reconnecting the same account twice) plus a partial unique index enforcing exactly one `is_primary = true` row per `(user_id, provider)`. New columns: `google_account_email` (fetched from Google's userinfo endpoint at connect time; null for pre-migration rows until reconnected), `label` (optional founder-chosen display name), `is_primary` (the default account for anything that doesn't ask explicitly, e.g. the Coach's day-type heuristic). Free/busy time for the decision engine and the `/calendar` view is merged across every connected account; "Adicionar ao calendário" asks which connected account to write the new event to whenever more than one is connected, defaulting to the primary when only one exists.

## `daily_check_ins`

Optional per-day check-in: `user_id`, `date`, `sleep_quality`/`energy_level`/`stress_level` (1–5), `physical_limitation`, `notes`. Unique `(user_id, date)`. RLS: owner-only.

## `decision_runs`

One row per user per day representing a single decision-generation run: `user_id`, `date`, `context_snapshot` (`jsonb` — the `DailyContext` used to generate that day's decisions, for debugging/audit), `engine_version` (default `'rules-v1'`), `generated_at`. Unique `(user_id, date)` — regenerating a day's decisions updates/replaces this row rather than accumulating duplicates. Also unique `(id, user_id)`, which exists purely so `decisions` can FK against `(decision_run_id, user_id)` and get owner-consistency enforced at the database level, not just in RLS.

## `decisions`

`user_id`, `decision_run_id` (FK to `decision_runs(id, user_id)` — enforces that a decision's `user_id` always matches its run's `user_id`), `date`, `title`, `reason`, `recommended_action`, `recommended_start`/`recommended_end` (`timestamptz`, nullable — a check constraint requires `end > start` when both are present), `domain` (`training`/`nutrition`/`sleep`/`recovery`/`planning`), `impact` (`low`/`medium`/`high`), `confidence` (`numeric(4,3)` between 0 and 1 — a continuous score, not a low/medium/high bucket), `source` (`rule`/`ai`/`hybrid` — which layer produced this decision), `status` (`proposed`/`accepted`/`edited`/`completed`/`skipped`), `calendar_event_id` (nullable, set by "Add to Calendar"), `completed_at`, `skipped_reason`. RLS: owner-only.

## `decision_feedback`

`user_id`, `decision_id` (FK to `decisions(id, user_id)`), `useful` (boolean, nullable), `feedback` (free text). Unique `(user_id, decision_id)` — one feedback row per decision. RLS: owner-only.

## Design notes carried over from earlier drafts of this document

- No table is named `google_tokens` — the implemented name is `calendar_connections`, provider-generic (`provider` column) even though only `google` is supported today.
- `decisions.domain` uses `planning` (matching `REBUILD_MASTER_HANDOFF.md`'s decision catalog), not `work-life-balance` — correct any decision-engine code or docs that still say `work-life-balance`.
- `confidence` is a numeric score (0–1), not a `low`/`medium`/`high` enum, as it was described in an earlier draft of this document.
- Indexes: `profiles(user_id)`, `calendar_connections(user_id)`, `daily_check_ins(user_id, date desc)`, `decision_runs(user_id, date desc)`, `decisions(user_id, date desc)`, `decisions(decision_run_id)`, `decisions(user_id, status)`, `decision_feedback(decision_id)`.
- `updated_at` is maintained by a shared `set_updated_at()` trigger applied to every table that has the column.

## Applying the migration

Not yet applied to a live project — no Supabase project exists yet (see `IMPLEMENTATION_STATUS.md`). Once one does: `supabase link` + `supabase db push`, or paste `supabase/migrations/202607290001_foundation.sql` into the SQL editor.
