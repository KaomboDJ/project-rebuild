-- Phase 1 — opt-in Web Push notifications. Subscriptions are private,
-- user-owned credentials; only the server service role may read endpoints.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute procedure public.set_updated_at();

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  daily_briefing boolean not null default true,
  decision_reminders boolean not null default true,
  nutrition_reminders boolean not null default true,
  briefing_time time not null default '07:30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute procedure public.set_updated_at();

alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from anon;
grant select, insert, update, delete on table public.notification_preferences to authenticated;
grant select, insert, update, delete on table public.notification_preferences to service_role;

create policy notification_preferences_select_own
  on public.notification_preferences for select
  to authenticated using (auth.uid() = user_id);
create policy notification_preferences_insert_own
  on public.notification_preferences for insert
  to authenticated with check (auth.uid() = user_id);
create policy notification_preferences_update_own
  on public.notification_preferences for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notification_preferences_delete_own
  on public.notification_preferences for delete
  to authenticated using (auth.uid() = user_id);

comment on table public.push_subscriptions is
  'Private Web Push delivery endpoints. Never expose through the browser database client.';
comment on table public.notification_preferences is
  'Founder-controlled notification categories. Sleep quiet hours are derived from profiles, not bypassable here.';

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null,
  delivered_at timestamptz not null default now(),
  unique (user_id, notification_key)
);

alter table public.notification_deliveries enable row level security;
revoke all on table public.notification_deliveries from anon, authenticated;
grant select, insert, delete on table public.notification_deliveries to service_role;
