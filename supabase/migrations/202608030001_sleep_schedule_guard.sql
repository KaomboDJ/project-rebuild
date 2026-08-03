-- Phase 1 completion: a user's habitual sleep window is first-class context.
-- Existing rows retain the founder-safe defaults; all fields remain editable.
alter table public.profiles
  add column if not exists target_wake_time text not null default '07:00'
    check (target_wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists weekend_sleep_time text
    check (weekend_sleep_time is null or weekend_sleep_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists weekend_wake_time text
    check (weekend_wake_time is null or weekend_wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists wind_down_minutes smallint not null default 45
    check (wind_down_minutes between 15 and 120),
  add column if not exists sleep_schedule_type text not null default 'regular'
    check (sleep_schedule_type in ('regular', 'shift'));

comment on column public.profiles.target_wake_time is
  'Habitual weekday wake time in the profile timezone.';
comment on column public.profiles.wind_down_minutes is
  'Protected low-stimulation period before the configured sleep time.';
comment on column public.profiles.sleep_schedule_type is
  'regular uses ordinary sleep guidance; shift prevents a universal 23:00 assumption.';

