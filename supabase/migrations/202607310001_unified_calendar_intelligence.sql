-- Unified Calendar Intelligence (docs/PRODUCT_BACKLOG.md milestone,
-- branch feature/unified-calendar-intelligence).
--
-- Two purely additive, backward-compatible changes:
--
--   1. Relaxes calendar_connections.provider's check constraint to allow
--      'microsoft' alongside the existing 'google'. No new columns are
--      added to calendar_connections: the existing encrypted_access_token/
--      encrypted_refresh_token/expires_at/scopes/calendar_id/
--      google_account_email/label/is_primary columns are generic enough to
--      hold a Microsoft account's OAuth state too (calendar_id already
--      defaults to 'primary', which matches Microsoft Graph's default
--      calendar convention). The google_account_email column keeps its
--      historical name rather than being renamed — renaming risks breaking
--      existing Google code paths for no functional gain — but is reused
--      to hold the account email for any provider going forward; treat it
--      as "connection_account_email" in spirit.
--
--   2. Adds calendar_sources: per-calendar (not per-account) selection and
--      role, so a connected account's calendars can each be independently
--      included/excluded from availability, shown/hidden in the workspace
--      UI, and marked as a valid write destination. This is new — no
--      existing table is touched or dropped.
--
-- Service-role only, same access model as calendar_connections: RLS is
-- enabled but all grants to anon/authenticated are revoked, because this
-- table holds calendar identifiers and OAuth-adjacent metadata that must
-- never be queried directly from the browser. The Decision Engine and
-- Settings UI both read/write it through server-side routes using the
-- admin/service-role client, exactly like calendar_connections.

alter table public.calendar_connections
  drop constraint calendar_connections_provider_check;

alter table public.calendar_connections
  add constraint calendar_connections_provider_check
  check (provider in ('google', 'microsoft'));

comment on column public.calendar_connections.google_account_email is
  'Identifies which account this connection is (originally Google-only, hence the name) so distinct connected accounts under the same provider are never conflated. Reused unchanged for provider = ''microsoft'' rows rather than renamed, to avoid touching every existing Google code path for a cosmetic gain.';

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  external_calendar_id text not null,
  name text not null,
  color text,
  is_read_only boolean not null default true,
  can_write boolean not null default false,
  selected_for_context boolean not null default true,
  visible_in_workspace boolean not null default true,
  is_default_destination boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_calendar_id),
  -- A calendar can only be offered as a write destination if it is
  -- actually writable — never let a stale/incorrect flag combination make
  -- the UI offer a destination the provider will reject.
  constraint calendar_sources_destination_requires_write
    check (not is_default_destination or can_write)
);

create index calendar_sources_user_id_idx on public.calendar_sources(user_id);
create index calendar_sources_connection_id_idx on public.calendar_sources(connection_id);

-- Exactly one default destination per user (mirrors calendar_connections'
-- one-primary-per-user pattern from 202607300005_multi_account_calendar.sql).
create unique index calendar_sources_one_default_destination_idx
  on public.calendar_sources (user_id)
  where is_default_destination;

create trigger calendar_sources_set_updated_at
before update on public.calendar_sources
for each row execute function public.set_updated_at();

alter table public.calendar_sources enable row level security;

revoke all on table public.calendar_sources from anon, authenticated;

comment on table public.calendar_sources is
  'Service-role only. Per-calendar (not per-account) selection: which calendars inside a connected Google/Microsoft account feed the availability engine, appear in the Rebuild calendar workspace, and may be offered as a write destination. Populated by server-side calendar-list discovery, never by direct client writes.';
