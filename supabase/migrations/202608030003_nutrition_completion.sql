-- Phase 1 nutrition completion: all three planning modes and a stable link
-- between a weekly plan and its automatically recalculated shopping list.

alter table public.nutrition_profiles
  add column preferred_plan_mode text not null default 'decide-for-me'
  check (preferred_plan_mode in ('decide-for-me', 'simple-rotation', 'flexible-week'));

alter table public.meal_plans drop constraint if exists meal_plans_mode_check;
alter table public.meal_plans
  add constraint meal_plans_mode_check
  check (mode in ('decide-for-me', 'simple-rotation', 'flexible-week'));

alter table public.shopping_lists
  add column meal_plan_id uuid references public.meal_plans(id) on delete cascade;

create unique index shopping_lists_meal_plan_id_unique
  on public.shopping_lists(meal_plan_id)
  where meal_plan_id is not null;

comment on column public.nutrition_profiles.preferred_plan_mode is
  'Decide-for-me, a deliberately repetitive simple rotation, or a flexible week with easy substitutions.';
comment on column public.shopping_lists.meal_plan_id is
  'When present, this list is generated from a weekly plan and recalculated in place after replacements/completions.';
