-- Milestone 13 — Automation and continuous synchronization.
--
-- daily_briefings: one row per (user_id, date), written by the scheduled
-- cron job (app/api/cron/daily-sync/route.ts, protected by CRON_SECRET —
-- see .env.example, which already anticipated "any future scheduled/cron
-- regeneration route"). Records whether today's decisions were proactively
-- generated before the founder opened the app, and whether the calendar has
-- since drifted enough (lib/decision-engine/drift.ts) that the founder
-- might want to regenerate. Upserted repeatedly through the day as the cron
-- re-runs — not an append-only ledger like inventory_events, since there is
-- only ever one "current" briefing per day, not a history of every check.
create table public.daily_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  generated_at timestamptz not null default now(),
  event_count integer not null default 0,
  free_minutes integer not null default 0,
  decisions_generated boolean not null default false,
  -- Set when lib/decision-engine/drift.ts detects the calendar has changed
  -- enough since the stored decision_runs.context_snapshot that today's
  -- three decisions may no longer reflect reality. Never auto-clears the
  -- founder's existing decisions — only surfaces a "consider regenerating"
  -- banner (components/CalendarWorkspace.tsx), matching the product
  -- principle "recommend, then confirm" rather than silently replacing a
  -- plan the founder already accepted.
  decisions_stale boolean not null default false,
  summary text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index daily_briefings_user_date_idx on public.daily_briefings(user_id, date desc);

alter table public.daily_briefings enable row level security;

create policy "daily_briefings_select_own"
on public.daily_briefings for select
to authenticated
using (auth.uid() = user_id);

-- Insert/update are only ever performed by the cron route via the
-- SUPABASE_SERVICE_ROLE_KEY admin client (lib/supabase/admin.ts), which
-- bypasses RLS entirely - these policies exist for defense in depth (e.g. if
-- a future authenticated write path is added) rather than being load-bearing
-- for the cron job itself.
create policy "daily_briefings_insert_own"
on public.daily_briefings for insert
to authenticated
with check (auth.uid() = user_id);

create policy "daily_briefings_update_own"
on public.daily_briefings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on table public.daily_briefings to authenticated;

-- No updated_at column/trigger here: generated_at is set explicitly by the
-- cron job on every upsert (it IS the "when was this last computed"
-- timestamp), so a separate auto-touched updated_at would be redundant.
