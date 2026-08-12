-- Timed Web Push requires a cadence faster than the Vercel Hobby daily-cron
-- limit. Supabase Cron invokes the already authenticated Vercel route every
-- 15 minutes. URL and bearer token live in Vault and are never stored here.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.invoke_rebuild_notification_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  cron_secret text;
begin
  select decrypted_secret
    into app_url
    from vault.decrypted_secrets
   where name = 'rebuild_app_url'
   limit 1;

  select decrypted_secret
    into cron_secret
    from vault.decrypted_secrets
   where name = 'rebuild_cron_secret'
   limit 1;

  -- A missing secret keeps the job inert instead of making an unauthenticated
  -- request. Production activation provisions both values separately.
  if app_url is null or cron_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(app_url, '/') || '/api/cron/notification-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function private.invoke_rebuild_notification_dispatch() from public, anon, authenticated;
grant execute on function private.invoke_rebuild_notification_dispatch() to postgres;

select cron.schedule(
  'rebuild-timed-notification-dispatch',
  '*/15 * * * *',
  'select private.invoke_rebuild_notification_dispatch();'
);
