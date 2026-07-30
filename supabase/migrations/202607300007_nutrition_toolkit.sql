-- Milestone 12 — Complete Nutrition Toolkit (PRODUCT_BACKLOG.md).
--
-- Builds on the Milestone 10/11 pantry+shopping foundation
-- (202607300003_pantry_shopping.sql, 202607300006_decisions_pantry_link.sql)
-- without touching it. Adds:
--   1. nutrition_profiles — the "minimum necessary information" the founder
--      supplies once (goal, diet style, allergies/exclusions, meals/day,
--      household size, cooking time, budget, variety, optional macro
--      targets). User-owned, RLS-scoped like every other per-user table.
--   2. recipes / recipe_ingredients — a small curated library (seeded below,
--      not user-generated, not AI-generated) the deterministic planner picks
--      from. Global reference data: readable by every authenticated user,
--      writable only by migrations/service role. No recipe is invented at
--      request time by an LLM — see lib/nutrition/planner.ts's header for why
--      (same "explicit rules before ML" principle as the Decision Engine).
--   3. meal_plans / meal_plan_items — the persisted 7-day plan a founder is
--      currently following, plus per-slot execution state (planned / eaten /
--      skipped) so completing a meal can auto-consume matching pantry stock
--      (lib/nutrition/queries.ts's completeMealPlanItem), mirroring
--      Milestone 11D's decisions.related_pantry_item auto-consume pattern.
--
-- Coaching-safety note (CLAUDE.md): recipes carry only descriptive
-- glycemic_note text (e.g. "moderado em hidratos, com fibra e proteína") —
-- never a medical claim, never a prescribed diet. Macro figures are labelled
-- as estimates everywhere they're surfaced (lib/nutrition/macros.ts).

create table public.nutrition_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  goal text not null default 'maintain-weight'
    check (goal in ('lose-weight', 'maintain-weight', 'build-muscle', 'manage-blood-sugar', 'improve-energy')),
  diet_style text not null default 'omnivore'
    check (diet_style in ('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'low-carb', 'mediterranean')),
  -- Free-vocabulary tags rather than a checked enum, same trade-off already
  -- made for profiles.preferred_training_days — the curated library
  -- (seeded below) only ever emits a known set, but user-entered exclusions
  -- must not be artificially constrained.
  allergies text[] not null default '{}',
  exclusions text[] not null default '{}',
  -- Free text so the founder's actual medical context (CLAUDE.md: reported
  -- prediabetes/possible insulin resistance, kidney-stone history) can be
  -- recorded verbatim and surfaced back in the UI/Coach prompt, never
  -- inferred or diagnosed by the app itself.
  medical_constraints text not null default '',
  meals_per_day integer not null default 3 check (meals_per_day between 2 and 5),
  include_snack boolean not null default true,
  people_count integer not null default 1 check (people_count between 1 and 12),
  cooking_time_minutes integer not null default 30 check (cooking_time_minutes between 5 and 180),
  budget_preference text not null default 'medium' check (budget_preference in ('low', 'medium', 'high')),
  variety_preference text not null default 'medium' check (variety_preference in ('low', 'medium', 'high')),
  -- Null until the founder (or a clinician, per PRODUCT_BACKLOG.md) supplies
  -- one — the planner falls back to a system estimate derived from goal,
  -- never a false-precision default (lib/nutrition/macros.ts).
  target_calories integer check (target_calories is null or target_calories > 0),
  target_protein_g integer check (target_protein_g is null or target_protein_g >= 0),
  target_carbs_g integer check (target_carbs_g is null or target_carbs_g >= 0),
  target_fat_g integer check (target_fat_g is null or target_fat_g >= 0),
  macro_source text not null default 'system-estimate'
    check (macro_source in ('system-estimate', 'user-provided', 'clinician-provided')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Global curated reference data — not user-owned (no user_id column). RLS is
-- still enabled for defense in depth, but the only policy is a blanket
-- "authenticated can select"; there is deliberately no insert/update/delete
-- grant to `authenticated`, so the library can only change via a migration
-- or the service role, the same append-only-by-design posture already used
-- for inventory_events (but here read-only rather than insert-only).
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  diet_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  prep_minutes integer not null check (prep_minutes > 0),
  servings integer not null default 1 check (servings > 0),
  calories_per_serving integer not null check (calories_per_serving > 0),
  protein_g_per_serving numeric(6, 1) not null check (protein_g_per_serving >= 0),
  carbs_g_per_serving numeric(6, 1) not null check (carbs_g_per_serving >= 0),
  fat_g_per_serving numeric(6, 1) not null check (fat_g_per_serving >= 0),
  fiber_g_per_serving numeric(6, 1) not null default 0 check (fiber_g_per_serving >= 0),
  budget_tier text not null default 'medium' check (budget_tier in ('low', 'medium', 'high')),
  -- Short, descriptive, never medical — see coaching-safety note above.
  glycemic_note text not null default '',
  instructions text not null default '',
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit text not null default 'unidade'
    check (unit in ('unidade', 'g', 'kg', 'ml', 'l')),
  -- Backlog requirement: "avoid listing optional ingredients as mandatory
  -- purchases" — the shopping-list generator (lib/nutrition/shopping.ts)
  -- skips optional lines entirely rather than just flagging them.
  optional boolean not null default false,
  grocery_section text not null default 'other'
    check (grocery_section in ('produce', 'protein', 'dairy', 'grain', 'pantry', 'frozen', 'beverage', 'other'))
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  -- MVP ships only "Decide for me" (PRODUCT_BACKLOG.md's default path).
  -- "Simple rotation" and "Flexible week" are documented, not built — see
  -- docs/IMPLEMENTATION_STATUS.md. Stored as text now so adding them later
  -- is a value addition, not a schema migration.
  mode text not null default 'decide-for-me' check (mode in ('decide-for-me')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start),
  unique (id, user_id)
);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_plan_id uuid not null,
  day_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  -- restrict, not cascade/set null: the curated library is not user-deletable
  -- and recipes are never removed by app code, only by a future migration —
  -- if that ever happens it must be a deliberate decision, not a silent
  -- orphaning of a founder's current week.
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  servings numeric(6, 2) not null default 1 check (servings > 0),
  status text not null default 'planned' check (status in ('planned', 'eaten', 'skipped')),
  eaten_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_date, meal_slot, meal_plan_id),
  constraint meal_plan_items_plan_owner_fk
    foreign key (meal_plan_id, user_id)
    references public.meal_plans(id, user_id)
    on delete cascade
);

create index nutrition_profiles_user_id_idx on public.nutrition_profiles(user_id);
create index recipes_meal_type_idx on public.recipes(meal_type);
create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);
create index meal_plans_user_id_idx on public.meal_plans(user_id, week_start desc);
create index meal_plan_items_plan_id_idx on public.meal_plan_items(meal_plan_id, day_date);
create index meal_plan_items_user_day_idx on public.meal_plan_items(user_id, day_date, meal_slot);

create trigger nutrition_profiles_set_updated_at
before update on public.nutrition_profiles
for each row execute function public.set_updated_at();

create trigger meal_plans_set_updated_at
before update on public.meal_plans
for each row execute function public.set_updated_at();

create trigger meal_plan_items_set_updated_at
before update on public.meal_plan_items
for each row execute function public.set_updated_at();

alter table public.nutrition_profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

create policy "nutrition_profiles_select_own"
on public.nutrition_profiles for select
to authenticated
using (auth.uid() = user_id);

create policy "nutrition_profiles_insert_own"
on public.nutrition_profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "nutrition_profiles_update_own"
on public.nutrition_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "nutrition_profiles_delete_own"
on public.nutrition_profiles for delete
to authenticated
using (auth.uid() = user_id);

-- Curated library: every authenticated user may read all rows (there is no
-- per-user ownership to filter on); no write policy is granted at all.
create policy "recipes_select_all"
on public.recipes for select
to authenticated
using (true);

create policy "recipe_ingredients_select_all"
on public.recipe_ingredients for select
to authenticated
using (true);

create policy "meal_plans_select_own"
on public.meal_plans for select
to authenticated
using (auth.uid() = user_id);

create policy "meal_plans_insert_own"
on public.meal_plans for insert
to authenticated
with check (auth.uid() = user_id);

create policy "meal_plans_update_own"
on public.meal_plans for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "meal_plans_delete_own"
on public.meal_plans for delete
to authenticated
using (auth.uid() = user_id);

create policy "meal_plan_items_select_own"
on public.meal_plan_items for select
to authenticated
using (auth.uid() = user_id);

create policy "meal_plan_items_insert_own"
on public.meal_plan_items for insert
to authenticated
with check (auth.uid() = user_id);

create policy "meal_plan_items_update_own"
on public.meal_plan_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "meal_plan_items_delete_own"
on public.meal_plan_items for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on table
  public.nutrition_profiles,
  public.meal_plans,
  public.meal_plan_items
to authenticated;

-- Read-only grant — no insert/update/delete for the app role, matching the
-- "curated by us, not by app code" design above.
grant select on table public.recipes, public.recipe_ingredients to authenticated;

-- Meal-execution mutation used by lib/nutrition/queries.ts's
-- completeMealPlanItem: marks a meal_plan_items row eaten/skipped in the
-- same statement it stamps eaten_at, so the app never has a read-then-write
-- race between "is this already eaten" and "mark it eaten" (same rationale
-- as apply_inventory_event). SECURITY INVOKER (default) — RLS above still
-- applies.
create or replace function public.set_meal_plan_item_status(
  p_meal_plan_item_id uuid,
  p_status text
)
returns public.meal_plan_items
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.meal_plan_items;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_status not in ('planned', 'eaten', 'skipped') then
    raise exception 'invalid_status';
  end if;

  update public.meal_plan_items
  set status = p_status,
      eaten_at = case when p_status = 'eaten' then now() else null end
  where id = p_meal_plan_item_id and user_id = v_user_id
  returning * into v_item;

  if v_item.id is null then
    raise exception 'meal_plan_item_not_found';
  end if;

  return v_item;
end;
$$;

grant execute on function public.set_meal_plan_item_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Seed: small curated meal library (PRODUCT_BACKLOG.md's "Minimum useful
-- version" — a small curated library, not a marketplace). 24 recipes, 6 per
-- meal_type, spanning omnivore/vegetarian/vegan/pescatarian/low-carb/
-- mediterranean diet_tags so lib/nutrition/planner.ts has real choices to
-- filter from for every diet_style + allergy/exclusion combination. Macro
-- figures are reasonable estimates for a single serving, not lab-measured —
-- surfaced to the user as estimates (lib/nutrition/macros.ts), never as
-- medical fact. Portions and glycemic_note lean moderate-carb /
-- higher-fibre/protein throughout, appropriate for a general audience
-- including someone managing blood sugar — this is a deliberate curation
-- choice, not a claim that any specific recipe is medically indicated.
-- ---------------------------------------------------------------------

insert into public.recipes (id, name, meal_type, diet_tags, allergens, prep_minutes, servings, calories_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving, fiber_g_per_serving, budget_tier, glycemic_note, instructions) values
  ('10000000-0000-4000-8000-000000000001', 'Iogurte grego com aveia e frutos vermelhos', 'breakfast', '{omnivore,vegetarian,mediterranean}', '{lactose,gluten}', 5, 1, 320, 22, 35, 9, 6, 'low', 'Rico em proteína e fibra; hidratos vêm sobretudo da fruta e aveia.', 'Misturar o iogurte com a aveia e cobrir com os frutos vermelhos.'),
  ('10000000-0000-4000-8000-000000000002', 'Ovos mexidos com espinafres e pão integral', 'breakfast', '{omnivore,vegetarian,mediterranean}', '{gluten,eggs}', 10, 1, 360, 24, 28, 16, 5, 'low', 'Moderado em hidratos, com fibra do pão integral e proteína dos ovos.', 'Saltear os espinafres, juntar os ovos batidos e mexer em lume brando. Servir com o pão.'),
  ('10000000-0000-4000-8000-000000000003', 'Papas de aveia com manteiga de amendoim e banana', 'breakfast', '{vegetarian,vegan}', '{nuts,gluten}', 8, 1, 380, 13, 48, 14, 7, 'low', 'Fibra alta da aveia; combinar com proteína ao almoço para equilíbrio.', 'Cozer a aveia em água ou bebida vegetal, juntar a manteiga de amendoim e a banana em rodelas.'),
  ('10000000-0000-4000-8000-000000000004', 'Omelete de queijo e cogumelos', 'breakfast', '{omnivore,vegetarian,low-carb}', '{eggs,lactose}', 10, 1, 340, 26, 6, 24, 2, 'medium', 'Baixo em hidratos, boa opção quando o foco é controlar o açúcar no sangue.', 'Saltear os cogumelos, juntar os ovos batidos e o queijo ralado, dobrar a omelete.'),
  ('10000000-0000-4000-8000-000000000005', 'Tofu mexido com legumes', 'breakfast', '{vegan,vegetarian,low-carb}', '{soy}', 12, 1, 300, 20, 14, 18, 5, 'medium', 'Baixo-moderado em hidratos, rico em fibra dos legumes.', 'Esfarelar o tofu, saltear com os legumes e temperar com cúrcuma e pimenta.'),
  ('10000000-0000-4000-8000-000000000006', 'Salmão fumado com queijo fresco e pepino', 'breakfast', '{pescatarian,mediterranean,low-carb}', '{fish,lactose}', 8, 1, 310, 24, 8, 20, 2, 'high', 'Muito baixo em hidratos, rico em ómega-3 e proteína.', 'Servir o salmão fumado com o queijo fresco e o pepino em rodelas.'),

  ('10000000-0000-4000-8000-000000000007', 'Frango grelhado com quinoa e brócolos', 'lunch', '{omnivore,mediterranean}', '{}', 30, 1, 520, 42, 45, 16, 8, 'medium', 'Equilibrado, com fibra da quinoa e brócolos.', 'Grelhar o frango temperado, cozer a quinoa e cozinhar os brócolos a vapor.'),
  ('10000000-0000-4000-8000-000000000008', 'Salada de grão-de-bico com atum e legumes', 'lunch', '{pescatarian,mediterranean}', '{fish}', 15, 1, 460, 32, 40, 15, 10, 'low', 'Fibra alta do grão-de-bico ajuda a moderar o pico glicémico da refeição.', 'Misturar o grão-de-bico escorrido, o atum, tomate, pepino e azeite.'),
  ('10000000-0000-4000-8000-000000000009', 'Wrap integral de peru e vegetais', 'lunch', '{omnivore}', '{gluten}', 12, 1, 430, 30, 42, 14, 6, 'low', 'Moderado em hidratos; pão integral traz mais fibra que branco.', 'Enrolar o peru fatiado, alface, tomate e cenoura ralada no wrap.'),
  ('10000000-0000-4000-8000-000000000010', 'Lentilhas estufadas com legumes', 'lunch', '{vegan,vegetarian,mediterranean}', '{}', 25, 2, 400, 22, 50, 10, 14, 'low', 'Fibra muito alta; boa opção para saciedade e controlo glicémico.', 'Estufar as lentilhas com cebola, cenoura, tomate e caldo de legumes.'),
  ('10000000-0000-4000-8000-000000000011', 'Bife de peru grelhado com salada de folhas verdes', 'lunch', '{omnivore,low-carb}', '{}', 20, 1, 380, 38, 10, 20, 5, 'medium', 'Baixo em hidratos, boa opção quando o foco é controlar o açúcar no sangue.', 'Grelhar o bife de peru e servir com salada verde temperada com azeite e limão.'),
  ('10000000-0000-4000-8000-000000000012', 'Bacalhau assado com legumes no forno', 'lunch', '{pescatarian,mediterranean,low-carb}', '{fish}', 35, 2, 420, 36, 18, 20, 6, 'high', 'Baixo-moderado em hidratos, rico em proteína magra.', 'Assar o bacalhau com pimentos, courgette e cebola, regado com azeite.'),

  ('10000000-0000-4000-8000-000000000013', 'Frango estufado com batata-doce e feijão verde', 'dinner', '{omnivore}', '{}', 35, 2, 480, 38, 40, 15, 7, 'medium', 'Batata-doce tem menor impacto glicémico que batata branca.', 'Estufar o frango com batata-doce em cubos, feijão verde e ervas.'),
  ('10000000-0000-4000-8000-000000000014', 'Salmão grelhado com espargos', 'dinner', '{pescatarian,mediterranean,low-carb}', '{fish}', 25, 1, 450, 36, 8, 28, 4, 'high', 'Muito baixo em hidratos, rico em ómega-3.', 'Grelhar o salmão temperado e os espargos com azeite e limão.'),
  ('10000000-0000-4000-8000-000000000015', 'Tofu grelhado com legumes salteados e arroz integral', 'dinner', '{vegan,vegetarian}', '{soy}', 25, 1, 460, 24, 55, 14, 8, 'medium', 'Arroz integral traz mais fibra que arroz branco.', 'Grelhar o tofu, saltear os legumes e servir com arroz integral.'),
  ('10000000-0000-4000-8000-000000000016', 'Sopa de legumes com feijão e frango desfiado', 'dinner', '{omnivore}', '{}', 30, 2, 380, 30, 32, 10, 9, 'low', 'Fibra alta do feijão; boa opção leve para a noite.', 'Cozinhar os legumes em caldo, juntar o feijão escorrido e o frango desfiado.'),
  ('10000000-0000-4000-8000-000000000017', 'Omelete de legumes com salada', 'dinner', '{omnivore,vegetarian,low-carb}', '{eggs}', 15, 1, 340, 22, 12, 22, 5, 'low', 'Baixo em hidratos, opção rápida para a noite.', 'Preparar uma omelete com pimento, cebola e courgette, servir com salada.'),
  ('10000000-0000-4000-8000-000000000018', 'Peixe branco grelhado com puré de couve-flor', 'dinner', '{pescatarian,low-carb,mediterranean}', '{fish}', 25, 1, 360, 34, 12, 16, 6, 'medium', 'Muito baixo em hidratos comparado com puré de batata tradicional.', 'Grelhar o peixe e servir com puré de couve-flor temperado com azeite.'),

  ('10000000-0000-4000-8000-000000000019', 'Punhado de nozes e maçã', 'snack', '{omnivore,vegetarian,vegan,mediterranean}', '{nuts}', 2, 1, 220, 5, 22, 14, 5, 'low', 'Fibra da maçã modera a absorção dos açúcares naturais.', 'Servir a maçã fatiada com um punhado de nozes.'),
  ('10000000-0000-4000-8000-000000000020', 'Queijo fresco com tomate cereja', 'snack', '{omnivore,vegetarian,low-carb,mediterranean}', '{lactose}', 3, 1, 180, 16, 6, 10, 2, 'low', 'Muito baixo em hidratos.', 'Servir o queijo fresco com os tomates cereja cortados ao meio.'),
  ('10000000-0000-4000-8000-000000000021', 'Húmus com palitos de cenoura e pepino', 'snack', '{vegan,vegetarian,mediterranean}', '{}', 5, 1, 200, 7, 20, 10, 6, 'low', 'Fibra dos legumes crus ajuda a saciedade.', 'Servir o húmus com os palitos de cenoura e pepino.'),
  ('10000000-0000-4000-8000-000000000022', 'Ovo cozido com um punhado de amêndoas', 'snack', '{omnivore,vegetarian,low-carb}', '{eggs,nuts}', 2, 1, 210, 13, 4, 16, 2, 'low', 'Muito baixo em hidratos, boa opção entre refeições.', 'Cozer o ovo previamente e combinar com as amêndoas.'),
  ('10000000-0000-4000-8000-000000000023', 'Iogurte natural com sementes de chia', 'snack', '{omnivore,vegetarian,low-carb}', '{lactose}', 3, 1, 190, 14, 12, 9, 6, 'low', 'Fibra alta das sementes de chia modera a resposta glicémica.', 'Misturar o iogurte com as sementes de chia e deixar repousar 5 minutos.'),
  ('10000000-0000-4000-8000-000000000024', 'Barrinha caseira de aveia e tâmara', 'snack', '{vegetarian,vegan}', '{gluten}', 10, 4, 210, 5, 30, 8, 4, 'low', 'Contém açúcares naturais da tâmara; consumir com moderação se a monitorizar glicemia.', 'Triturar a aveia com as tâmaras e frutos secos, moldar em barras e refrigerar.')
;

insert into public.recipe_ingredients (recipe_id, name, quantity, unit, optional, grocery_section) values
  ('10000000-0000-4000-8000-000000000001', 'Iogurte grego', 200, 'g', false, 'dairy'),
  ('10000000-0000-4000-8000-000000000001', 'Aveia', 40, 'g', false, 'grain'),
  ('10000000-0000-4000-8000-000000000001', 'Frutos vermelhos', 80, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000001', 'Mel', 10, 'g', true, 'pantry'),

  ('10000000-0000-4000-8000-000000000002', 'Ovos', 3, 'unidade', false, 'protein'),
  ('10000000-0000-4000-8000-000000000002', 'Espinafres', 60, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000002', 'Pão integral', 2, 'unidade', false, 'grain'),
  ('10000000-0000-4000-8000-000000000002', 'Azeite', 5, 'ml', true, 'pantry'),

  ('10000000-0000-4000-8000-000000000003', 'Aveia', 50, 'g', false, 'grain'),
  ('10000000-0000-4000-8000-000000000003', 'Manteiga de amendoim', 20, 'g', false, 'pantry'),
  ('10000000-0000-4000-8000-000000000003', 'Banana', 1, 'unidade', false, 'produce'),
  ('10000000-0000-4000-8000-000000000003', 'Bebida vegetal', 200, 'ml', true, 'beverage'),

  ('10000000-0000-4000-8000-000000000004', 'Ovos', 3, 'unidade', false, 'protein'),
  ('10000000-0000-4000-8000-000000000004', 'Cogumelos', 80, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000004', 'Queijo', 30, 'g', false, 'dairy'),

  ('10000000-0000-4000-8000-000000000005', 'Tofu', 150, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000005', 'Pimento', 80, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000005', 'Cebola', 40, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000005', 'Cúrcuma', 2, 'g', true, 'pantry'),

  ('10000000-0000-4000-8000-000000000006', 'Salmão fumado', 80, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000006', 'Queijo fresco', 60, 'g', false, 'dairy'),
  ('10000000-0000-4000-8000-000000000006', 'Pepino', 80, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000007', 'Peito de frango', 150, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000007', 'Quinoa', 70, 'g', false, 'grain'),
  ('10000000-0000-4000-8000-000000000007', 'Brócolos', 120, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000007', 'Azeite', 10, 'ml', true, 'pantry'),

  ('10000000-0000-4000-8000-000000000008', 'Grão-de-bico cozido', 150, 'g', false, 'pantry'),
  ('10000000-0000-4000-8000-000000000008', 'Atum em conserva', 100, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000008', 'Tomate', 80, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000008', 'Pepino', 60, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000009', 'Peito de peru fatiado', 100, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000009', 'Wrap integral', 1, 'unidade', false, 'grain'),
  ('10000000-0000-4000-8000-000000000009', 'Alface', 30, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000009', 'Cenoura', 40, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000010', 'Lentilhas', 150, 'g', false, 'pantry'),
  ('10000000-0000-4000-8000-000000000010', 'Cenoura', 60, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000010', 'Tomate', 100, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000010', 'Cebola', 40, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000011', 'Bife de peru', 150, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000011', 'Folhas verdes', 80, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000011', 'Azeite', 10, 'ml', true, 'pantry'),

  ('10000000-0000-4000-8000-000000000012', 'Bacalhau', 180, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000012', 'Pimento', 80, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000012', 'Courgette', 80, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000012', 'Cebola', 50, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000013', 'Peito de frango', 180, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000013', 'Batata-doce', 150, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000013', 'Feijão verde', 100, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000014', 'Salmão', 180, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000014', 'Espargos', 100, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000014', 'Azeite', 10, 'ml', true, 'pantry'),

  ('10000000-0000-4000-8000-000000000015', 'Tofu', 160, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000015', 'Legumes variados', 150, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000015', 'Arroz integral', 70, 'g', false, 'grain'),

  ('10000000-0000-4000-8000-000000000016', 'Peito de frango cozido e desfiado', 100, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000016', 'Feijão branco', 100, 'g', false, 'pantry'),
  ('10000000-0000-4000-8000-000000000016', 'Legumes para sopa', 200, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000017', 'Ovos', 3, 'unidade', false, 'protein'),
  ('10000000-0000-4000-8000-000000000017', 'Pimento', 60, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000017', 'Courgette', 60, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000017', 'Folhas verdes', 60, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000018', 'Peixe branco', 180, 'g', false, 'protein'),
  ('10000000-0000-4000-8000-000000000018', 'Couve-flor', 200, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000018', 'Azeite', 10, 'ml', true, 'pantry'),

  ('10000000-0000-4000-8000-000000000019', 'Nozes', 20, 'g', false, 'pantry'),
  ('10000000-0000-4000-8000-000000000019', 'Maçã', 1, 'unidade', false, 'produce'),

  ('10000000-0000-4000-8000-000000000020', 'Queijo fresco', 80, 'g', false, 'dairy'),
  ('10000000-0000-4000-8000-000000000020', 'Tomate cereja', 80, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000021', 'Húmus', 60, 'g', false, 'pantry'),
  ('10000000-0000-4000-8000-000000000021', 'Cenoura', 60, 'g', false, 'produce'),
  ('10000000-0000-4000-8000-000000000021', 'Pepino', 60, 'g', false, 'produce'),

  ('10000000-0000-4000-8000-000000000022', 'Ovos', 1, 'unidade', false, 'protein'),
  ('10000000-0000-4000-8000-000000000022', 'Amêndoas', 20, 'g', false, 'pantry'),

  ('10000000-0000-4000-8000-000000000023', 'Iogurte natural', 150, 'g', false, 'dairy'),
  ('10000000-0000-4000-8000-000000000023', 'Sementes de chia', 15, 'g', false, 'pantry'),

  ('10000000-0000-4000-8000-000000000024', 'Aveia', 150, 'g', false, 'grain'),
  ('10000000-0000-4000-8000-000000000024', 'Tâmaras', 100, 'g', false, 'pantry'),
  ('10000000-0000-4000-8000-000000000024', 'Frutos secos variados', 50, 'g', true, 'pantry')
;
