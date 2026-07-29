create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_name text not null default '',
  timezone text not null default 'Europe/Lisbon',
  current_identity text not null default '',
  desired_identity text not null default '',
  primary_objective text not null default 'rebuild-fitness'
    check (
      primary_objective in (
        'rebuild-fitness',
        'lose-weight',
        'train-consistently',
        'improve-nutrition',
        'improve-sleep'
      )
    ),
  preferred_training_days text[] not null default '{}',
  preferred_training_time text not null default '12:00'
    check (preferred_training_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  typical_dinner_time text not null default '20:00'
    check (typical_dinner_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  target_sleep_time text not null default '23:00'
    check (target_sleep_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  working_hours jsonb not null default '{"start":"09:00","end":"18:00"}'::jsonb,
  current_constraints text not null default '',
  intervention_tone text not null default 'direto e prático',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.daily_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_quality smallint check (sleep_quality between 1 and 5),
  energy_level smallint check (energy_level between 1 and 5),
  stress_level smallint check (stress_level between 1 and 5),
  physical_limitation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.decision_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  context_snapshot jsonb not null default '{}'::jsonb,
  engine_version text not null default 'rules-v1',
  generated_at timestamptz not null default now(),
  unique (user_id, date),
  unique (id, user_id)
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision_run_id uuid not null,
  date date not null,
  title text not null,
  reason text not null,
  recommended_action text not null,
  recommended_start timestamptz,
  recommended_end timestamptz,
  domain text not null
    check (domain in ('training', 'nutrition', 'sleep', 'recovery', 'planning')),
  impact text not null check (impact in ('low', 'medium', 'high')),
  confidence numeric(4, 3) not null default 0.5 check (confidence between 0 and 1),
  source text not null default 'rule' check (source in ('rule', 'ai', 'hybrid')),
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'edited', 'completed', 'skipped')),
  calendar_event_id text,
  completed_at timestamptz,
  skipped_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint decisions_run_owner_fk
    foreign key (decision_run_id, user_id)
    references public.decision_runs(id, user_id)
    on delete cascade,
  constraint decisions_recommended_interval_check
    check (
      recommended_start is null
      or recommended_end is null
      or recommended_end > recommended_start
    )
);

create table public.decision_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision_id uuid not null,
  useful boolean,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, decision_id),
  constraint decision_feedback_owner_fk
    foreign key (decision_id, user_id)
    references public.decisions(id, user_id)
    on delete cascade
);

create index profiles_user_id_idx on public.profiles(user_id);
create index calendar_connections_user_id_idx on public.calendar_connections(user_id);
create index daily_check_ins_user_date_idx on public.daily_check_ins(user_id, date desc);
create index decision_runs_user_date_idx on public.decision_runs(user_id, date desc);
create index decisions_user_date_idx on public.decisions(user_id, date desc);
create index decisions_run_id_idx on public.decisions(decision_run_id);
create index decisions_status_idx on public.decisions(user_id, status);
create index decision_feedback_decision_id_idx on public.decision_feedback(decision_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger calendar_connections_set_updated_at
before update on public.calendar_connections
for each row execute function public.set_updated_at();

create trigger daily_check_ins_set_updated_at
before update on public.daily_check_ins
for each row execute function public.set_updated_at();

create trigger decisions_set_updated_at
before update on public.decisions
for each row execute function public.set_updated_at();

create trigger decision_feedback_set_updated_at
before update on public.decision_feedback
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.daily_check_ins enable row level security;
alter table public.decision_runs enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_feedback enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = user_id);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profiles_delete_own"
on public.profiles for delete
to authenticated
using (auth.uid() = user_id);

create policy "daily_check_ins_select_own"
on public.daily_check_ins for select
to authenticated
using (auth.uid() = user_id);

create policy "daily_check_ins_insert_own"
on public.daily_check_ins for insert
to authenticated
with check (auth.uid() = user_id);

create policy "daily_check_ins_update_own"
on public.daily_check_ins for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "daily_check_ins_delete_own"
on public.daily_check_ins for delete
to authenticated
using (auth.uid() = user_id);

create policy "decision_runs_select_own"
on public.decision_runs for select
to authenticated
using (auth.uid() = user_id);

create policy "decision_runs_insert_own"
on public.decision_runs for insert
to authenticated
with check (auth.uid() = user_id);

create policy "decision_runs_update_own"
on public.decision_runs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "decision_runs_delete_own"
on public.decision_runs for delete
to authenticated
using (auth.uid() = user_id);

create policy "decisions_select_own"
on public.decisions for select
to authenticated
using (auth.uid() = user_id);

create policy "decisions_insert_own"
on public.decisions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "decisions_update_own"
on public.decisions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "decisions_delete_own"
on public.decisions for delete
to authenticated
using (auth.uid() = user_id);

create policy "decision_feedback_select_own"
on public.decision_feedback for select
to authenticated
using (auth.uid() = user_id);

create policy "decision_feedback_insert_own"
on public.decision_feedback for insert
to authenticated
with check (auth.uid() = user_id);

create policy "decision_feedback_update_own"
on public.decision_feedback for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "decision_feedback_delete_own"
on public.decision_feedback for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on table
  public.profiles,
  public.daily_check_ins,
  public.decision_runs,
  public.decisions,
  public.decision_feedback
to authenticated;

revoke all on table public.calendar_connections from anon, authenticated;

comment on table public.calendar_connections is
  'Service-role only. OAuth tokens must be encrypted before insert and never returned to browser clients.';
