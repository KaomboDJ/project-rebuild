-- Closes the documented consent-bypass gap (docs/IMPLEMENTATION_STATUS.md,
-- "Auth UX Hardening" section, task #146): OnboardingForm.tsx's privacy/
-- terms consent checkbox was previously enforced client-side only, before
-- a direct browser-to-Supabase upsert — a technically sophisticated user
-- could call `supabase.from("profiles").upsert(...)` directly and set
-- `onboarding_completed: true` without ever consenting, since RLS only
-- protects the *data* boundary (who can touch which row), not what values
-- a row is allowed to hold.
--
-- Deliberately narrow, per the risk this doc entry already flagged: a
-- blanket `check` constraint was rejected because Postgres re-evaluates
-- `check` constraints on every UPDATE of a row, not just when the
-- constrained columns change — that would have broken the founder's own
-- pre-existing profile (onboarding_completed already true,
-- privacy_consent_at/terms_accepted_at nullable by design for exactly this
-- reason) the next time they saved an edit in /settings. This trigger only
-- runs its check on the actual transition INTO onboarding_completed = true
-- — a fresh insert, or an update from not-true to true — so:
--   * the founder's own existing profile is untouched by any later
--     /settings save (onboarding_completed is already true beforehand, so
--     the transition condition is false and the check never runs);
--   * app/api/profile/route.ts's PUT handler (used by /settings) never
--     writes onboarding_completed at all, so it can never trigger this
--     either;
--   * a genuinely new onboarding (including after "Reiniciar conta de
--     teste", which deletes the profiles row outright) goes through a
--     fresh INSERT with onboarding_completed: true, which IS checked.
create or replace function public.enforce_onboarding_consent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.onboarding_completed is true then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.onboarding_completed is not true) then
      if new.privacy_consent_at is null or new.terms_accepted_at is null then
        raise exception 'onboarding_completed requires privacy_consent_at and terms_accepted_at to already be set'
          using errcode = '23514'; -- check_violation, so callers see a constraint-shaped error
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_onboarding_consent_trigger on public.profiles;

create trigger enforce_onboarding_consent_trigger
  before insert or update on public.profiles
  for each row
  execute function public.enforce_onboarding_consent();

comment on function public.enforce_onboarding_consent() is
  'Blocks a direct-to-Supabase write from setting onboarding_completed=true without both consent timestamps already present, without re-checking rows that are already onboarded (task #146).';
