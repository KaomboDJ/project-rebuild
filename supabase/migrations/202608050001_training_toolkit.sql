-- Milestone 15 — Training Toolkit (founder request, 2026-08-05: "é
-- possível [o Coach] elaborar um treino para a semana toda?").
--
-- Mirrors supabase/migrations/202607300007_nutrition_toolkit.sql's
-- architecture one-for-one, for training instead of meals:
--   1. training_profiles — the minimum settings the founder supplies once
--      (which training categories they actually do, session length, where
--      they train, intensity, variety), same "small, explicit inputs"
--      shape as nutrition_profiles.
--   2. workout_sessions — a small curated library (seeded below, not
--      user-generated, not AI-generated at request time) the deterministic
--      planner (lib/training/planner.ts) picks from. Global reference data,
--      readable by every authenticated user, writable only by
--      migrations/service role — identical posture to recipes/
--      recipe_ingredients, and for the same reason
--      (lib/nutrition/planner.ts's header: recipe/session *selection* is
--      never delegated to an LLM).
--   3. training_plans / training_plan_items — the persisted 7-day plan a
--      founder is currently following, one planned session per day (a rest
--      day is simply a day with no row, never a placeholder "rest"
--      session) plus execution state (planned/done/skipped).
--
-- workout_type_id values are lib/nutrition/workout-types.ts's
-- TrainingCategory ids (the check constraint below lists the same 8
-- values) — that module is the single source of truth for labels/example
-- styles/macro guidance. The founder's own correction (2026-08-05): a
-- session's *category* is what a founder actually picks for a day
-- ("Musculação" vs "Yoga" vs "Muay Thai"), and striking martial arts
-- (Muay Thai, kickboxing, boxing) must not share a category with grappling
-- martial arts (jiu-jitsu, judo, wrestling, sambo) — they are physically
-- different disciplines. Light cardio (walking, easy jog) and heavy cardio
-- (HIIT, sprints, bike/row intervals) are separate categories for the same
-- reason. `name` carries the specific named style within a category.
--
-- Coaching-safety note (CLAUDE.md): every session's structure/safety_note
-- is deliberately general and moderate (no aggressive volume/intensity
-- prescriptions, no medical claims), written for a general audience,
-- with an explicit "para se sentires dor aguda" caveat — never a
-- personalized training-program prescription, which would need a real
-- coach/clinician, not this app.

create table public.training_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  -- Subset of lib/nutrition/workout-types.ts's TrainingCategory ids the
  -- founder actually wants in rotation. Empty (the default, before the
  -- founder fills this in) means "no preference yet" — the planner then
  -- draws from every category rather than leaving every day unplanned,
  -- same "the app must still work without a completed profile" principle
  -- context-builder.ts's DEFAULT_PROFILE already applies elsewhere.
  preferred_categories text[] not null default '{}',
  session_duration_minutes integer not null default 45 check (session_duration_minutes between 10 and 180),
  location text not null default 'mixed' check (location in ('home', 'gym', 'outdoor', 'mixed')),
  intensity_preference text not null default 'medium' check (intensity_preference in ('low', 'medium', 'high')),
  variety_preference text not null default 'medium' check (variety_preference in ('low', 'medium', 'high')),
  -- Free text, same treatment as nutrition_profiles.medical_constraints:
  -- recorded verbatim and surfaced back in the UI/Coach prompt, never
  -- auto-parsed into a filtering rule (we cannot safely auto-interpret
  -- free-text medical/physical constraints in code).
  physical_limitations text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Global curated reference data — same read-only-to-the-app posture as
-- recipes/recipe_ingredients: RLS enabled for defense in depth, but the
-- only policy is a blanket "authenticated can select", no write grant to
-- `authenticated` at all.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  workout_type_id text not null check (workout_type_id in (
    'calistenia', 'cardio_leve', 'cardio_pesado', 'hipertrofia',
    'artes_marciais_strike', 'wrestling_grappling', 'mobilidade', 'parkour'
  )),
  duration_minutes integer not null check (duration_minutes > 0),
  location text not null default 'mixed' check (location in ('home', 'gym', 'outdoor', 'mixed')),
  intensity text not null default 'medium' check (intensity in ('low', 'medium', 'high')),
  equipment text[] not null default '{}',
  -- Short, deterministic session outline (warm-up / main block / cool-down)
  -- — descriptive, not a rigid numeric prescription; see coaching-safety
  -- note above.
  structure text not null default '',
  safety_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start),
  unique (id, user_id)
);

create table public.training_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_plan_id uuid not null,
  day_date date not null,
  -- restrict, not cascade/set null: the curated library is not
  -- user-deletable and sessions are never removed by app code, only by a
  -- future migration — same rationale as meal_plan_items.recipe_id.
  session_id uuid not null references public.workout_sessions(id) on delete restrict,
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One planned session per day per plan — a rest day is a day with no
  -- row at all, not a placeholder "rest" session.
  unique (day_date, training_plan_id),
  constraint training_plan_items_plan_owner_fk
    foreign key (training_plan_id, user_id)
    references public.training_plans(id, user_id)
    on delete cascade
);

create index training_profiles_user_id_idx on public.training_profiles(user_id);
create index workout_sessions_type_idx on public.workout_sessions(workout_type_id);
create index training_plans_user_id_idx on public.training_plans(user_id, week_start desc);
create index training_plan_items_plan_id_idx on public.training_plan_items(training_plan_id, day_date);
create index training_plan_items_user_day_idx on public.training_plan_items(user_id, day_date);

create trigger training_profiles_set_updated_at
before update on public.training_profiles
for each row execute function public.set_updated_at();

create trigger training_plans_set_updated_at
before update on public.training_plans
for each row execute function public.set_updated_at();

create trigger training_plan_items_set_updated_at
before update on public.training_plan_items
for each row execute function public.set_updated_at();

alter table public.training_profiles enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.training_plans enable row level security;
alter table public.training_plan_items enable row level security;

create policy "training_profiles_select_own"
on public.training_profiles for select
to authenticated
using (auth.uid() = user_id);

create policy "training_profiles_insert_own"
on public.training_profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "training_profiles_update_own"
on public.training_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "training_profiles_delete_own"
on public.training_profiles for delete
to authenticated
using (auth.uid() = user_id);

create policy "workout_sessions_select_all"
on public.workout_sessions for select
to authenticated
using (true);

create policy "training_plans_select_own"
on public.training_plans for select
to authenticated
using (auth.uid() = user_id);

create policy "training_plans_insert_own"
on public.training_plans for insert
to authenticated
with check (auth.uid() = user_id);

create policy "training_plans_update_own"
on public.training_plans for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "training_plans_delete_own"
on public.training_plans for delete
to authenticated
using (auth.uid() = user_id);

create policy "training_plan_items_select_own"
on public.training_plan_items for select
to authenticated
using (auth.uid() = user_id);

create policy "training_plan_items_insert_own"
on public.training_plan_items for insert
to authenticated
with check (auth.uid() = user_id);

create policy "training_plan_items_update_own"
on public.training_plan_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "training_plan_items_delete_own"
on public.training_plan_items for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on table
  public.training_profiles,
  public.training_plans,
  public.training_plan_items
to authenticated;

-- Read-only grant — same "curated by us, not by app code" design as recipes.
grant select on table public.workout_sessions to authenticated;

-- Mirrors set_meal_plan_item_status: atomic status+completed_at update, so
-- the app never has a read-then-write race between "is this already done"
-- and "mark it done".
create or replace function public.set_training_plan_item_status(
  p_training_plan_item_id uuid,
  p_status text
)
returns public.training_plan_items
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.training_plan_items;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_status not in ('planned', 'done', 'skipped') then
    raise exception 'invalid_status';
  end if;

  update public.training_plan_items
  set status = p_status,
      completed_at = case when p_status = 'done' then now() else null end
  where id = p_training_plan_item_id and user_id = v_user_id
  returning * into v_item;

  if v_item.id is null then
    raise exception 'training_plan_item_not_found';
  end if;

  return v_item;
end;
$$;

grant execute on function public.set_training_plan_item_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Seed: small curated session library — 33 sessions across the 8
-- categories, so lib/training/planner.ts has real variety to choose from
-- for every founder preference/location/duration combination. Structures
-- are deliberately general and moderate (warm-up / main block / cool-down
-- outlines, adjustable effort language), never a rigid numeric
-- prescription — see the coaching-safety note at the top of this file.
-- Explicitly includes Muay Thai, Kickboxing (strike) and Judo/Wrestling/
-- Sambo (grappling) as named sessions per the founder's own examples, kept
-- separate from each other exactly because the physical demands differ.
-- ---------------------------------------------------------------------

insert into public.workout_sessions (id, name, workout_type_id, duration_minutes, location, intensity, equipment, structure, safety_note) values
  -- calistenia
  ('20000000-0000-4000-8000-000000000001', 'Calistenia — corpo inteiro (base)', 'calistenia', 35, 'home', 'medium', '{}', 'Aquecimento: 5 min mobilidade. Bloco principal: flexões, agachamentos, prancha e remo invertido (ou variante) — 3 séries de cada com repetições confortáveis. Arrefecimento: alongamento.', 'Ajusta as variantes (joelhos, inclinação) ao teu nível; técnica antes de repetições.'),
  ('20000000-0000-4000-8000-000000000002', 'Calistenia — progressões avançadas', 'calistenia', 40, 'gym', 'high', '{barra fixa}', 'Aquecimento: 8 min. Bloco principal: progressões de dominadas, flexões avançadas e exercícios de equilíbrio de força. Arrefecimento: alongamento.', 'Progride gradualmente para variantes mais avançadas; para perante dor articular.'),
  ('20000000-0000-4000-8000-000000000003', 'Calistenia — core e mobilidade', 'calistenia', 35, 'home', 'medium', '{tapete}', 'Aquecimento: 5 min. Bloco principal: exercícios de core (prancha, elevações de perna, rotações controladas) e mobilidade geral com o peso do corpo. Arrefecimento: alongamento.', 'Movimento controlado, sem sacudir a zona lombar; para se sentires dor.'),

  -- cardio_leve
  ('20000000-0000-4000-8000-000000000004', 'Natação contínua', 'cardio_leve', 40, 'gym', 'medium', '{piscina}', 'Aquecimento: 200m fácil. Bloco principal: 20-25 min a ritmo constante e confortável, foco na respiração. Arrefecimento: 100m calmo.', 'Se sentires falta de ar fora do normal ou tonturas, sai da água e descansa.'),
  ('20000000-0000-4000-8000-000000000005', 'Corrida leve / jogging', 'cardio_leve', 35, 'outdoor', 'low', '{}', 'Aquecimento: 5 min a andar/trote leve. Bloco principal: 20-25 min a ritmo confortável em que consigas manter uma conversa. Arrefecimento: 5 min a andar.', 'Se sentires dor no peito, tonturas ou falta de ar anormal, para imediatamente.'),
  ('20000000-0000-4000-8000-000000000006', 'Ciclismo contínuo', 'cardio_leve', 45, 'outdoor', 'medium', '{bicicleta}', 'Aquecimento: 5 min ritmo leve. Bloco principal: 30-35 min a ritmo constante e confortável. Arrefecimento: 5-10 min ritmo leve.', 'Usa capacete; hidrata-te bem em percursos mais longos.'),
  ('20000000-0000-4000-8000-000000000007', 'Caminhada rápida', 'cardio_leve', 40, 'outdoor', 'low', '{}', 'Caminhada a ritmo vivo mas confortável durante 35-40 min, com 5 min de ritmo mais calmo no início e fim.', 'Boa opção em dias de recuperação ou pouca energia; usa calçado confortável.'),
  ('20000000-0000-4000-8000-000000000008', 'Dança — cardio ritmado', 'cardio_leve', 40, 'mixed', 'medium', '{}', 'Aquecimento: 5 min. Bloco principal: sequência de dança cardio (estilo livre ou coreografia simples) 25-30 min, ritmo contínuo. Arrefecimento: alongamento.', 'Boa opção divertida de cardio; ajusta o ritmo se sentires falta de ar anormal.'),

  -- cardio_pesado
  ('20000000-0000-4000-8000-000000000009', 'HIIT — circuito de alta intensidade', 'cardio_pesado', 30, 'home', 'high', '{}', 'Aquecimento: 5 min. Bloco principal: circuito de exercícios cardio de alto impacto (saltos, burpees, mountain climbers) em blocos de 40s trabalho / 20s descanso. Arrefecimento: 5 min.', 'Treino intenso — reduz o impacto (evita saltos) se tiveres problemas articulares; hidrata-te bem.'),
  ('20000000-0000-4000-8000-000000000010', 'Corrida de sprints (intervalada)', 'cardio_pesado', 30, 'outdoor', 'high', '{}', 'Aquecimento: 8 min trote leve. Bloco principal: 6x2 min a ritmo forte com 2 min de recuperação a andar/trote leve. Arrefecimento: 5 min.', 'Ajusta o ritmo forte ao teu nível; para se sentires dor no peito ou tonturas.'),
  ('20000000-0000-4000-8000-000000000011', 'Máquina de bike (spin) intervalado', 'cardio_pesado', 35, 'gym', 'high', '{bicicleta estática}', 'Aquecimento: 5 min. Bloco principal: 20-25 min alternando 1 min de esforço forte com 1-2 min de ritmo leve. Arrefecimento: 5 min ritmo leve.', 'Ajusta a resistência gradualmente; hidrata-te durante a sessão.'),
  ('20000000-0000-4000-8000-000000000012', 'Remo intervalado', 'cardio_pesado', 30, 'gym', 'high', '{remo}', 'Aquecimento: 5 min ritmo leve. Bloco principal: 8x250m a ritmo forte com 90s de descanso entre repetições. Arrefecimento: 5 min ritmo leve.', 'Mantém as costas direitas durante o movimento; para se sentires dor lombar.'),
  ('20000000-0000-4000-8000-000000000013', 'Natação intervalada', 'cardio_pesado', 35, 'gym', 'high', '{piscina}', 'Aquecimento: 200m fácil. Bloco principal: 8x50m a ritmo forte com 30s de descanso entre repetições. Arrefecimento: 150m calmo.', 'Ajusta o número de repetições ao teu nível; para se sentires tonturas ou falta de ar anormal.'),

  -- hipertrofia
  ('20000000-0000-4000-8000-000000000014', 'Musculação — corpo inteiro (iniciação)', 'hipertrofia', 45, 'gym', 'medium', '{halteres,máquinas}', 'Aquecimento: 5 min cardio ligeiro. Bloco principal: agachamento, remada, supino, elevações laterais e prancha — 3 séries de cada, com repetições confortáveis e boa técnica. Arrefecimento: alongamento 5 min.', 'Prioriza a técnica sobre a carga; para imediatamente se sentires dor articular aguda.'),
  ('20000000-0000-4000-8000-000000000015', 'Musculação — foco superior/inferior', 'hipertrofia', 50, 'gym', 'medium', '{halteres,barra,máquinas}', 'Aquecimento: 5 min mobilidade. Bloco principal: supino, remada curvada, elevações laterais, agachamento e afundo — 3-4 séries com esforço moderado a alto. Arrefecimento: alongamento 5-8 min.', 'Aumenta a carga de forma gradual ao longo das semanas; pára se sentires dor articular aguda.'),
  ('20000000-0000-4000-8000-000000000016', 'Musculação — força funcional', 'hipertrofia', 45, 'gym', 'medium', '{halteres,barra}', 'Aquecimento: 8 min. Bloco principal: levantamentos funcionais (agachamento, levantamento terra, press) em blocos de séries moderadas. Arrefecimento: alongamento.', 'Técnica antes de carga; para perante dor articular aguda.'),

  -- artes_marciais_strike
  ('20000000-0000-4000-8000-000000000017', 'Muay Thai — técnica e sacos', 'artes_marciais_strike', 50, 'gym', 'medium', '{sacos,luvas}', 'Aquecimento: 10 min mobilidade e shadow boxing. Bloco principal: combinações técnicas de socos, cotoveladas e joelhadas no saco, 5-6 rounds de 3 min com descanso. Arrefecimento: alongamento.', 'Usa proteção adequada nas mãos e canelas; ajusta a força dos golpes ao teu nível.'),
  ('20000000-0000-4000-8000-000000000018', 'Kickboxing — condicionamento', 'artes_marciais_strike', 45, 'gym', 'high', '{sacos,cordas}', 'Aquecimento: 8 min. Bloco principal: circuito alternando saco de kickboxing (2 min) e cardio/corda (1 min), 5-6 séries. Arrefecimento: alongamento.', 'Intensidade alta — hidrata-te bem e reduz a duração se estiveres com pouca energia.'),
  ('20000000-0000-4000-8000-000000000019', 'Boxe — técnica no saco', 'artes_marciais_strike', 40, 'gym', 'medium', '{saco,luvas}', 'Aquecimento: 10 min shadow boxing. Bloco principal: combinações técnicas no saco, 6 rounds de 3 min com 1 min de descanso. Arrefecimento: alongamento.', 'Protege as mãos e pulsos com ligaduras/luvas adequadas.'),

  -- wrestling_grappling
  ('20000000-0000-4000-8000-000000000020', 'Jiu-jitsu — treino técnico', 'wrestling_grappling', 60, 'gym', 'medium', '{kimono/tatame}', 'Aquecimento: 10 min mobilidade e movimentos de solo. Bloco principal: revisão de 2-3 técnicas com o parceiro, drilling repetido. Sparring leve opcional 10-15 min. Arrefecimento: alongamento.', 'Comunica sempre com o parceiro de treino; para de imediato perante qualquer dor articular.'),
  ('20000000-0000-4000-8000-000000000021', 'Jiu-jitsu — sparring', 'wrestling_grappling', 60, 'gym', 'high', '{kimono/tatame}', 'Aquecimento: 10 min mobilidade. Bloco principal: 5-6 rounds de sparring de 5 min com descanso entre rounds. Arrefecimento: alongamento e respiração.', 'Ajusta a intensidade do sparring ao teu estado físico do dia; hidrata-te bem.'),
  ('20000000-0000-4000-8000-000000000022', 'Wrestling / Judo — técnica e drilling', 'wrestling_grappling', 55, 'gym', 'medium', '{tatame}', 'Aquecimento: 10 min mobilidade e quedas controladas. Bloco principal: drilling de projeções/quedas e controlo no solo com o parceiro, técnica repetida. Arrefecimento: alongamento.', 'Pratica quedas apenas em tatame adequado; comunica sempre com o parceiro de treino.'),

  -- mobilidade
  ('20000000-0000-4000-8000-000000000023', 'Yoga suave', 'mobilidade', 30, 'mixed', 'low', '{tapete}', 'Sequência de posturas suaves com foco na respiração — saudação ao sol lenta, posturas de equilíbrio e alongamento, terminando em relaxamento final (savasana) 5 min.', 'Nunca forces uma postura até à dor; usa apoios (bloco, almofada) sempre que precisares.'),
  ('20000000-0000-4000-8000-000000000024', 'Yoga — mobilidade e respiração', 'mobilidade', 25, 'mixed', 'low', '{tapete}', 'Foco em mobilidade articular (ancas, ombros, coluna) e exercícios de respiração guiada, sem sequência de posturas intensas.', 'Movimento lento e controlado; para se sentires desconforto.'),
  ('20000000-0000-4000-8000-000000000025', 'Pilates — core e postura', 'mobilidade', 35, 'mixed', 'low', '{tapete}', 'Aquecimento: respiração e ativação do core. Bloco principal: exercícios de controlo postural, core e mobilidade da coluna, movimentos lentos e controlados. Arrefecimento: alongamento.', 'Movimento controlado, sem sacudir; para se sentires dor lombar.'),
  ('20000000-0000-4000-8000-000000000026', 'Pilates com equipamento leve', 'mobilidade', 40, 'gym', 'low', '{bandas elásticas}', 'Aquecimento: mobilidade. Bloco principal: exercícios de força leve com bandas elásticas para core, glúteos e ombros. Arrefecimento: alongamento.', 'Escolhe a resistência da banda de forma progressiva.'),
  ('20000000-0000-4000-8000-000000000027', 'Dança — expressiva e relaxante', 'mobilidade', 30, 'mixed', 'low', '{}', 'Movimento livre e expressivo ao som de música, sem coreografia fixa, foco no prazer do movimento e na respiração.', 'Sem pressão de desempenho — o objetivo é movimento e bem-estar, não técnica.'),

  -- parkour
  ('20000000-0000-4000-8000-000000000028', 'Parkour — fundamentos', 'parkour', 40, 'outdoor', 'medium', '{}', 'Aquecimento: 10 min mobilidade e corrida leve. Bloco principal: prática de saltos, apoios de mão e rolamentos em superfícies baixas e seguras. Arrefecimento: alongamento.', 'Pratica sempre em superfícies conhecidas e seguras; nunca tentes um movimento além do teu nível técnico.'),
  ('20000000-0000-4000-8000-000000000029', 'Parkour — condicionamento', 'parkour', 35, 'outdoor', 'medium', '{}', 'Aquecimento: 8 min. Bloco principal: exercícios de força funcional (flexões, agachamentos, equilíbrio) que sustentam os movimentos de parkour, sem saltos de risco. Arrefecimento: alongamento.', 'Prioriza técnica e controlo sobre altura/distância.')
;
