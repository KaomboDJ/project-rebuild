-- Fix: "Não foi possível gerar a lista de compras." live on production.
--
-- 202608030003_nutrition_completion.sql added a PARTIAL unique index
-- (`where meal_plan_id is not null`) as the intended upsert target for
-- lib/nutrition/queries.ts's generateShoppingListForPlan, which calls
-- supabase.from("shopping_lists").upsert(..., { onConflict: "meal_plan_id" }).
--
-- Postgres can only infer a partial unique index as an ON CONFLICT arbiter
-- when the INSERT's own ON CONFLICT clause repeats the same WHERE
-- predicate - supabase-js's upsert() has no way to express that predicate,
-- so it always emits a plain `ON CONFLICT (meal_plan_id) DO UPDATE ...`,
-- which cannot match the partial index and fails with "there is no unique
-- or exclusion constraint matching the ON CONFLICT specification" every
-- time a founder clicks "Lista de compras".
--
-- Fix: a plain UNIQUE constraint already allows unlimited NULLs under
-- standard SQL semantics (NULL is never considered equal to NULL), so it
-- gives the exact same "unique only when set" behaviour the partial index
-- was reaching for, while also being a valid, unconditional ON CONFLICT
-- target.

drop index if exists public.shopping_lists_meal_plan_id_unique;

alter table public.shopping_lists
  add constraint shopping_lists_meal_plan_id_unique unique (meal_plan_id);

comment on constraint shopping_lists_meal_plan_id_unique on public.shopping_lists is
  'Plain unique constraint (not a partial index) so generateShoppingListForPlan''s upsert(..., { onConflict: "meal_plan_id" }) can actually use it as its ON CONFLICT arbiter. Multiple NULL meal_plan_id rows (manually-managed lists, unrelated to a weekly plan) remain unrestricted, same as before.';
