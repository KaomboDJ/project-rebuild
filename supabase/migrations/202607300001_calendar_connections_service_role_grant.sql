-- Milestone 3 bugfix: calendar_connections was created with RLS enabled and
-- explicitly revoked from anon/authenticated (correct — it's service-role
-- only, see its table comment), but unlike every other table in
-- 202607290001_foundation.sql it never received an explicit grant to
-- service_role either. The other 5 tables all have:
--   grant select, insert, update, delete on table ... to authenticated;
-- giving the RLS-scoped browser client its base table privileges.
-- calendar_connections has no equivalent statement for service_role, so the
-- admin client (lib/supabase/admin.ts, used exclusively for this table) has
-- been failing every write with a Postgres-level "permission denied for
-- table calendar_connections" — not an RLS policy rejection, a missing
-- GRANT. This surfaced live: the Google Calendar OAuth callback
-- (app/api/google/callback/route.ts) has been failing for the founder with
-- this exact error since Milestone 3 shipped.
--
-- service_role already has BYPASSRLS, so it doesn't need (and shouldn't
-- get) an RLS policy — it needs the base table grant that was simply
-- missed.

grant select, insert, update, delete on table public.calendar_connections to service_role;
