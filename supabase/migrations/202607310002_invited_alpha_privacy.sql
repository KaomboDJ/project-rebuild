-- Invited-alpha privacy readiness.
--
-- New users explicitly acknowledge the alpha terms and consent to the
-- processing of the routine, wellbeing and nutrition data they choose to
-- enter. Columns stay nullable so existing founder/test profiles continue
-- to work; the onboarding UI requires both timestamps for every new profile.

alter table public.profiles
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.privacy_consent_at is
  'When the user explicitly consented to processing the personal wellbeing, routine and nutrition data they enter.';

comment on column public.profiles.terms_accepted_at is
  'When the user accepted the current private-alpha terms.';
