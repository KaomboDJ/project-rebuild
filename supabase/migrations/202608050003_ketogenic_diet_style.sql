-- Founder request (2026-08-05): "No geral até ia puxar isto para um tipo
-- de dieta especifica. dar a opção se Cetogénica Vegetariana, Vegan etc
-- etc" — adds a Cetogénica (ketogenic) diet style alongside the existing
-- six (omnivore/vegetarian/vegan/pescatarian/low-carb/mediterranean).
--
-- Tags 'ketogenic' onto the recipe library's already very-low-carb,
-- higher-fat dishes (each already ~4-12g carbs per serving, several
-- already tagged 'low-carb') rather than inventing new recipes from
-- scratch - their macros were already reviewed by
-- 202607300007_nutrition_toolkit.sql and are genuinely keto-appropriate,
-- so this widens the low-carb end of the existing library instead of
-- just relabeling it.

alter table public.nutrition_profiles drop constraint if exists nutrition_profiles_diet_style_check;
alter table public.nutrition_profiles add constraint nutrition_profiles_diet_style_check
  check (diet_style in ('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'low-carb', 'mediterranean', 'ketogenic'));

update public.recipes
set diet_tags = array(select distinct unnest(diet_tags || '{ketogenic}'))
where id in (
  '10000000-0000-4000-8000-000000000004', -- Omelete de queijo e cogumelos (breakfast, 6g carbs)
  '10000000-0000-4000-8000-000000000006', -- Salmão fumado com queijo fresco e pepino (breakfast, 8g carbs)
  '10000000-0000-4000-8000-000000000011', -- Bife de peru grelhado com salada de folhas verdes (lunch, 10g carbs)
  '10000000-0000-4000-8000-000000000014', -- Salmão grelhado com espargos (dinner, 8g carbs)
  '10000000-0000-4000-8000-000000000017', -- Omelete de legumes com salada (dinner, 12g carbs)
  '10000000-0000-4000-8000-000000000018', -- Peixe branco grelhado com puré de couve-flor (dinner, 12g carbs)
  '10000000-0000-4000-8000-000000000020', -- Queijo fresco com tomate cereja (snack, 6g carbs)
  '10000000-0000-4000-8000-000000000022'  -- Ovo cozido com um punhado de amêndoas (snack, 4g carbs)
);
