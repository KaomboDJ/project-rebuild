-- Fix: regenerating a plan's shopping list silently wipes manual items.
--
-- Founder report (2026-08-05): "Eu coloquei comida na lista mas a maior
-- parte das sugestões não inclui a comida que pus na lista." Root cause:
-- lib/nutrition/queries.ts's generateShoppingListForPlan deletes every
-- shopping_list_items row on the plan's shopping_lists row before
-- re-inserting the freshly computed lines - with no way to tell "a line
-- the planner generated last time" apart from "a line the founder typed in
-- by hand on /nutrition/shopping". app/(app)/nutrition/shopping/page.tsx's
-- getOrCreateOpenShoppingList just returns whichever shopping_lists row
-- was most recently created with status = 'open', which becomes the
-- plan-linked list the moment it's generated - so anything the founder
-- adds there afterwards lives on that same row, and the next "Gerar
-- plano"/"Lista de compras" click wipes it along with the stale plan
-- lines.
--
-- Fix: tag every shopping_list_items row with where it came from, so
-- generateShoppingListForPlan can delete-and-reinsert only its own
-- previously-generated lines (source = 'meal_plan'), never anything the
-- founder added by hand (source = 'manual', the default - see
-- lib/pantry/queries.ts's addShoppingItem) or via the Coach (source =
-- 'coach' - see lib/coach/tools.ts's add_to_shopping_list handler).

alter table public.shopping_list_items
  add column source text not null default 'manual' check (source in ('manual', 'meal_plan', 'coach'));

comment on column public.shopping_list_items.source is
  'Where this line came from - lets generateShoppingListForPlan safely delete-and-reinsert only its own auto-generated lines (meal_plan) without wiping anything added by hand (manual) or via the Coach (coach).';

-- Backfill: every existing item on a plan-linked shopping list
-- (shopping_lists.meal_plan_id is not null) was written exclusively by
-- generateShoppingListForPlan - the only writer for those rows before this
-- migration - so it's correctly source = 'meal_plan', not the column
-- default. Anything a founder later adds to that same list gets the
-- 'manual' default and stays protected from then on.
update public.shopping_list_items sli
set source = 'meal_plan'
from public.shopping_lists sl
where sli.shopping_list_id = sl.id
  and sl.meal_plan_id is not null;
