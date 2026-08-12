-- Milestone 16A — Health Data Bridge foundation.
--
-- This migration stores normalized observations imported by a future
-- native Rebuild Companion from Apple HealthKit or Android Health Connect.
-- The web PWA cannot access those native stores directly. Every reading is
-- attributable, idempotent and user-owned; no medical diagnosis is derived.

create table public.health_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null check (btrim(source_key) <> ''),
  provider text not null check (provider in (
    'apple_health', 'health_connect', 'xiaomi_mi_fitness',
    'xiaomi_home', 'manual_import'
  )),
  label text not null check (btrim(label) <> ''),
  device_name text,
  authorized_metrics text[] not null default '{}',
  constraint health_sources_authorized_metrics_check check (authorized_metrics <@ array[
    'height_cm', 'weight_kg', 'body_fat_percent', 'visceral_fat_index',
    'steps_count', 'sleep_minutes', 'resting_heart_rate_bpm', 'hrv_ms',
    'workout_minutes', 'spo2_percent'
  ]::text[]),
  use_for_coaching boolean not null default true,
  status text not null default 'active' check (status in ('active', 'disconnected', 'error')),
  last_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_key),
  unique (id, user_id)
);

create table public.health_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  health_source_id uuid not null,
  metric text not null check (metric in (
    'height_cm', 'weight_kg', 'body_fat_percent', 'visceral_fat_index',
    'steps_count', 'sleep_minutes', 'resting_heart_rate_bpm', 'hrv_ms',
    'workout_minutes', 'spo2_percent'
  )),
  value numeric not null,
  unit text not null,
  recorded_at timestamptz not null,
  external_record_id text not null check (btrim(external_record_id) <> ''),
  origin_name text,
  device_name text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (health_source_id, external_record_id),
  constraint health_observations_unit_check check (unit = case metric
    when 'height_cm' then 'cm'
    when 'weight_kg' then 'kg'
    when 'body_fat_percent' then '%'
    when 'visceral_fat_index' then 'index'
    when 'steps_count' then 'count'
    when 'sleep_minutes' then 'min'
    when 'resting_heart_rate_bpm' then 'bpm'
    when 'hrv_ms' then 'ms'
    when 'workout_minutes' then 'min'
    when 'spo2_percent' then '%'
  end),
  constraint health_observations_plausible_value_check check (case metric
    when 'height_cm' then value between 80 and 250
    when 'weight_kg' then value between 20 and 400
    when 'body_fat_percent' then value between 2 and 75
    when 'visceral_fat_index' then value between 0 and 100
    when 'steps_count' then value between 0 and 200000
    when 'sleep_minutes' then value between 0 and 1440
    when 'resting_heart_rate_bpm' then value between 20 and 250
    when 'hrv_ms' then value between 0 and 1000
    when 'workout_minutes' then value between 0 and 1440
    when 'spo2_percent' then value between 50 and 100
  end),
  constraint health_observations_source_owner_fk
    foreign key (health_source_id, user_id)
    references public.health_sources(id, user_id)
    on delete cascade
);

create table public.health_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  health_source_id uuid not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  records_read integer not null default 0 check (records_read >= 0),
  records_imported integer not null default 0 check (records_imported >= 0),
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint health_sync_runs_source_owner_fk
    foreign key (health_source_id, user_id)
    references public.health_sources(id, user_id)
    on delete cascade
);

create index health_sources_user_idx on public.health_sources(user_id, status);
create index health_observations_user_metric_time_idx
  on public.health_observations(user_id, metric, recorded_at desc);
create index health_sync_runs_source_time_idx
  on public.health_sync_runs(health_source_id, started_at desc);

create trigger health_sources_set_updated_at
before update on public.health_sources
for each row execute procedure public.set_updated_at();

alter table public.health_sources enable row level security;
alter table public.health_observations enable row level security;
alter table public.health_sync_runs enable row level security;

revoke all on table public.health_sources, public.health_observations, public.health_sync_runs from anon;
-- Browser sessions may read their data, remove a source (which cascades its
-- observations) and opt a source in/out of coaching. Only service_role-backed
-- server/Companion routes may assert provenance or write imported readings.
grant select, delete on table public.health_sources to authenticated;
grant update (use_for_coaching) on table public.health_sources to authenticated;
grant select on table public.health_observations, public.health_sync_runs to authenticated;
grant select, insert, update, delete on table public.health_sources, public.health_observations, public.health_sync_runs to service_role;

create policy health_sources_own_all on public.health_sources
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy health_observations_own_all on public.health_observations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy health_sync_runs_own_all on public.health_sync_runs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.health_sources is
  'Read-only health data origins authorized by the user. No OAuth/access tokens are stored here.';
comment on table public.health_observations is
  'Canonical, attributable health readings imported from a native aggregator. BMI is deliberately derived, never stored.';
comment on column public.health_sources.use_for_coaching is
  'Explicit control over whether observations from this source may influence Rebuild coaching and decisions.';
