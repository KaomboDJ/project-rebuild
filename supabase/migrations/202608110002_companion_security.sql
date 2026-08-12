-- Milestone 16B — private Android Companion pairing and device credentials.
--
-- The web session creates a short-lived, one-use pairing code. The Android
-- Companion exchanges it for a high-entropy device token. Only HMAC hashes are
-- stored. Device tokens are scoped to health import, expire automatically and
-- can be revoked from the authenticated web application.

create table public.companion_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique check (length(code_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint companion_pairing_codes_expiry_check check (expires_at > created_at)
);

create table public.companion_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null check (btrim(installation_id) <> '' and length(installation_id) <= 200),
  device_name text not null check (btrim(device_name) <> '' and length(device_name) <= 120),
  token_hash text not null unique check (length(token_hash) = 64),
  scopes text[] not null default array['health:write']::text[],
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installation_id),
  constraint companion_devices_scope_check check (scopes <@ array['health:write']::text[]),
  constraint companion_devices_expiry_check check (expires_at > created_at)
);

create index companion_pairing_codes_user_expiry_idx
  on public.companion_pairing_codes(user_id, expires_at desc);
create index companion_devices_user_status_idx
  on public.companion_devices(user_id, status, expires_at desc);

create trigger companion_devices_set_updated_at
before update on public.companion_devices
for each row execute procedure public.set_updated_at();

alter table public.companion_pairing_codes enable row level security;
alter table public.companion_devices enable row level security;

revoke all on table public.companion_pairing_codes, public.companion_devices from anon;
grant select, insert, delete on table public.companion_pairing_codes to authenticated;
grant select, delete on table public.companion_devices to authenticated;
grant select, insert, update, delete on table public.companion_pairing_codes, public.companion_devices to service_role;

create policy companion_pairing_codes_own on public.companion_pairing_codes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy companion_devices_own_select on public.companion_devices
  for select to authenticated
  using (auth.uid() = user_id);

create policy companion_devices_own_delete on public.companion_devices
  for delete to authenticated
  using (auth.uid() = user_id);

-- Atomic one-use exchange. This function is intentionally callable only by
-- service_role from the server route. It never receives or returns plaintext
-- secrets and fixes search_path to prevent SECURITY DEFINER object shadowing.
create or replace function public.exchange_companion_pairing_code(
  p_code_hash text,
  p_token_hash text,
  p_device_name text,
  p_installation_id text,
  p_expires_at timestamptz
)
returns table(user_id uuid, device_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code public.companion_pairing_codes%rowtype;
  v_device_id uuid;
begin
  select * into v_code
  from public.companion_pairing_codes
  where code_hash = p_code_hash
  for update;

  if not found or v_code.used_at is not null or v_code.expires_at <= now() then
    return;
  end if;

  update public.companion_pairing_codes
  set used_at = now()
  where id = v_code.id;

  insert into public.companion_devices (
    user_id, installation_id, device_name, token_hash, scopes,
    status, expires_at, revoked_at, last_seen_at
  ) values (
    v_code.user_id, btrim(p_installation_id), btrim(p_device_name),
    p_token_hash, array['health:write']::text[], 'active', p_expires_at,
    null, now()
  )
  on conflict (user_id, installation_id) do update
  set device_name = excluded.device_name,
      token_hash = excluded.token_hash,
      scopes = excluded.scopes,
      status = 'active',
      expires_at = excluded.expires_at,
      revoked_at = null,
      last_seen_at = now()
  returning id into v_device_id;

  return query select v_code.user_id, v_device_id;
end;
$$;

revoke all on function public.exchange_companion_pairing_code(text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.exchange_companion_pairing_code(text, text, text, text, timestamptz)
  to service_role;

comment on table public.companion_devices is
  'Revocable, expiring Android Companion credentials. Only HMAC token hashes are stored.';
comment on table public.companion_pairing_codes is
  'One-use HMAC pairing-code hashes. Plaintext pairing codes are returned once and never persisted.';
