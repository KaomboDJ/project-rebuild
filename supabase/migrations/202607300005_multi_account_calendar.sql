-- Milestone 11A: multi-account Google Calendar.
--
-- Until now `calendar_connections` hard-locked one Google account per user
-- (unique(user_id, provider)); every read/write path in lib/google/calendar.ts
-- assumed exactly one row. The founder confirmed (2026-07-30) that multiple
-- connected accounts should be merged for planning (free/busy computed
-- across all of them) while "Adicionar ao calendário" always asks which
-- connected account to write the new event to when more than one exists.
--
-- This migration:
--   1. Drops the single-account unique constraint.
--   2. Adds google_account_email (identifies which Google account a row is,
--      so re-authorizing the same account updates it instead of duplicating
--      it), label (optional founder-chosen display name), and is_primary
--      (the default account for anything that doesn't ask explicitly, e.g.
--      the day-type heuristic or a future non-interactive job).
--   3. Enforces at most one primary connection per (user_id, provider) via a
--      partial unique index, and at most one row per (user_id, provider,
--      google_account_email) to prevent reconnecting the same account twice
--      (NULLs from pre-migration rows don't collide with each other, which
--      is fine - there is at most one such legacy row per user anyway).
--   4. Backfills existing rows to is_primary = true - safe because the old
--      unique(user_id, provider) constraint guarantees at most one existing
--      row per user today.

alter table public.calendar_connections
  drop constraint calendar_connections_user_id_provider_key;

alter table public.calendar_connections
  add column google_account_email text,
  add column label text,
  add column is_primary boolean not null default false;

update public.calendar_connections
  set is_primary = true
  where is_primary = false;

create unique index calendar_connections_one_primary_idx
  on public.calendar_connections (user_id, provider)
  where is_primary;

create unique index calendar_connections_account_identity_idx
  on public.calendar_connections (user_id, provider, google_account_email);

comment on column public.calendar_connections.google_account_email is
  'Google account email for this connection, fetched via the userinfo endpoint at connect time. Null for connections made before Milestone 11A - they still work (a single legacy row remains usable and primary) but should be reconnected to populate this for display.';
comment on column public.calendar_connections.is_primary is
  'The default connection for anything that does not ask explicitly which account to use (e.g. the Coach day-type heuristic, or a future background job). Exactly one true row per (user_id, provider), enforced by calendar_connections_one_primary_idx.';
