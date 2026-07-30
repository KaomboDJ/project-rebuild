-- Coach UX and Pantry Intelligence milestone (Part 4) — day-type context.
--
-- "Day type" (home office vs. out of the house) drives whether the Coach's
-- suggest_available_meal tool (lib/coach/tools.ts) filters the pantry to
-- portable items. Two places to store it, matching the founder's specified
-- priority chain (lib/coach/day-type.ts):
--   1. daily_check_ins.day_type — today's explicit answer, the highest
--      priority signal, asked once per day at most.
--   2. profiles.default_day_type — the recurring default from the
--      onboarding/settings profile, used when today has no explicit answer.
-- If neither is set, day-type.ts falls back to a low-confidence calendar
-- heuristic and, below a confidence threshold, the Coach asks directly
-- instead of guessing — nothing in this migration persists that fallback,
-- by design (it's a same-request inference, not stored context).

alter table public.profiles
  add column default_day_type text
    check (default_day_type in ('home', 'office', 'mixed'));

alter table public.daily_check_ins
  add column day_type text
    check (day_type in ('home', 'office')),
  add column day_type_source text
    check (day_type_source in ('check-in', 'profile', 'calendar-heuristic'));
