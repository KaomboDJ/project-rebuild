alter table public.decisions
  add column if not exists timing_type text not null default 'flexible'
    check (timing_type in ('calendar_slot', 'trigger_based', 'flexible'));

alter table public.decisions
  add column if not exists trigger_label text;

alter table public.decisions
  add column if not exists calendar_connection_id uuid
    references public.calendar_connections(id) on delete set null;

alter table public.decision_runs
  add column if not exists plan_confirmed_at timestamptz;

comment on column public.decisions.timing_type is
  'calendar_slot may become an external event; trigger_based stays local; flexible can happen throughout the day.';
comment on column public.decisions.trigger_label is
  'Display-only moment for trigger-based decisions. Never parsed into a time.';
comment on column public.decisions.calendar_connection_id is
  'Connected calendar account that owns calendar_event_id; required for safe event updates in multi-account setups.';
comment on column public.decision_runs.plan_confirmed_at is
  'First explicit confirmation of the compiled Home day plan.';
