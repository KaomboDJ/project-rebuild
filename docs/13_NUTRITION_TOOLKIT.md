# 13 — Nutrition Toolkit (Milestone 12)

Implements `PRODUCT_BACKLOG.md`'s Nutrition Toolkit entry, gated open by the
2026-07-30 full-roadmap authorization (`docs/12_ROADMAP.md`). Builds on the
Milestone 10/11 pantry+shopping foundation without changing it.

## What shipped

1. **Nutrition profile** (`nutrition_profiles`) — the "minimum necessary
   information" the founder supplies once: goal, diet style, allergies,
   exclusions, free-text medical constraints, meals/day, optional snack,
   household size, cooking time budget, budget tier, variety preference, and
   optional macro targets (system-estimated by default). `/nutrition/profile`.
2. **Recipe library** (`recipes` + `recipe_ingredients`) — 24 curated
   recipes (6 per meal type), seeded by migration, spanning
   omnivore/vegetarian/vegan/pescatarian/low-carb/mediterranean diet tags.
   Global reference data: readable by every authenticated user, writable
   only by a migration (RLS grants `select` only to `authenticated`).
3. **7-day planner** (`lib/nutrition/planner.ts`) — deterministic, pure,
   synchronous. Filters the library by hard constraints (diet style,
   allergies, exclusions — never relaxed) then soft constraints (cooking
   time, budget — relaxed one at a time if they'd leave zero candidates),
   then fills 7 days x (breakfast/lunch/dinner + optional snack) with a
   variety-window rotation. No AI call is involved in *selecting* meals —
   see the module's header comment for why, mirroring the Decision Engine's
   "AI ranks/rewrites, never selects" contract.
4. **Persistence** (`meal_plans` + `meal_plan_items`) — one plan per
   `(user_id, week_start)`; regenerating replaces the week's items wholesale
   (same "latest run replaces the previous one" contract as
   `decision_runs`/`decisions`). Each item tracks `planned` / `eaten` /
   `skipped` status.
5. **Meal execution** — marking an item "eaten" (`set_meal_plan_item_status`
   RPC) best-effort auto-consumes the recipe's non-optional ingredients from
   the pantry by name match, via the existing `apply_inventory_event` RPC —
   same forgiving, never-blocking contract as Milestone 11D's
   `consumeRelatedPantryItem`.
6. **Meal replacement** — same meal slot, closest-calorie-match alternative
   from the filtered candidate pool (`suggestReplacement`), satisfying the
   backlog's "same nutritional category" requirement.
7. **Shopping list** (`lib/nutrition/shopping.ts` +
   `generateShoppingListForPlan`) — aggregates every planned (not
   eaten/skipped) meal's non-optional ingredients, scales for household
   size, rounds to realistic purchase quantities (never down), subtracts
   on-hand pantry stock by name match, and writes a fresh
   `shopping_lists`/`shopping_list_items` row (Milestone 10 schema) named
   after the plan's week. A fresh list per call (not a mutated persistent
   one) is how "update automatically when a meal is replaced" is satisfied
   without a reactive-recompute system.
8. **Macro estimates** (`lib/nutrition/macros.ts`) — per-day and week-average
   calories/protein/carbs/fat/fibre, always presented with a ±10% band in
   the UI, never as a bare number — the backlog's "prefer useful ranges over
   false precision" and "never present estimated macros as medical advice".
9. **Decision Engine integration** — `decideDinnerEarly` /
   `avoidTakeawayCommitment` (Milestone 11C/11D) now prefer today's planned
   dinner over the ad-hoc pantry pick when a plan exists
   (`DailyContext.todaysDinnerPlanName`, populated in
   `app/api/decisions/generate/route.ts` via
   `lib/nutrition/queries.ts#getTodaysDinnerPlanName`). A planned meal is a
   stronger, already-decided commitment than "whatever's about to expire".
10. **Coach integration** — four new tools (`lib/coach/tools.ts`):
    `get_week_plan` (read-only), `generate_week_plan`, `replace_meal`,
    `mark_meal_eaten` (all three mutating, confirm-gated like every other
    Coach mutation). System prompt updated to tell the model never to
    invent recipes/macros — always call `get_week_plan` first.

## Continuous nutrition journey UX

The toolkit's capabilities are presented as one continuous, dependency-aware
journey at `/nutrition`, in this order:

1. **Profile** — establishes goals, constraints, budget, variety, and optional
   macro targets.
2. **Pantry** — records what is already available so recommendations and
   purchases are grounded in reality.
3. **Weekly plan** — generates the seven-day plan from the profile and pantry
   context.
4. **Shopping** — derives only what is missing after pantry stock is
   subtracted.

All four tools remain available at their individual routes for direct access,
but the primary experience no longer requires returning to the Alimentação
menu between steps. A compact progress navigator, in-context next actions, and
short completion acknowledgements keep one clear action visible without
turning the flow into a points/achievement system. Profile dropdowns use the
shared dark, keyboard-accessible listbox component rather than the Windows
native white popup, whose surface cannot be reliably themed with CSS.

## Phase 1 completion update (2026-08-03)

The earlier limitations below have now been implemented: planning supports
Simple rotation and Flexible week in addition to Decide for me;
`mealsPerDay` selects 2, 3 or 4 daily slots; the linked shopping list is
recalculated after plan changes or meal execution; and the plan displays a
deterministic batch-preparation order. Cross-week variety continuity and
AI-written weekly summaries remain intentionally outside Phase 1.

## Historical limitations before the Phase 1 completion slice

- **Simple rotation / Flexible week planning modes** — `meal_plans.mode` is
  a checked column already scoped to accept future values; only
  `decide-for-me` exists today.
- **`profiles.mealsPerDay` driving which slots are planned** — the planner
  always plans breakfast/lunch/dinner and toggles only the snack via
  `includeSnack`, per the backlog's minimum-useful-version wording ("three
  meals and an optional snack") taken literally. `mealsPerDay` is captured
  and persisted for future use.
- **Cross-week variety continuity** — `generateWeekPlan`'s
  `carryOverRecipeIds` parameter exists but nothing currently populates it;
  each week's variety window resets at the Monday boundary.
- **AI-written weekly summaries** — no AI touches the Nutrition Toolkit yet;
  if added later it must only rephrase what the deterministic planner
  already chose, never choose differently (same contract as
  `lib/decision-engine/validation.ts`).

## Coaching-safety note

Every recipe's `glycemic_note` is descriptive, not prescriptive (e.g.
"moderado em hidratos, com fibra e proteína"), and the library leans
moderate-carb / higher-fibre-and-protein throughout given the founder's
reported prediabetes/possible insulin resistance — a curation choice, not a
diagnosis or a claim of medical indication. `nutrition_profiles.medical_constraints`
is free text recorded verbatim, never inferred. No calorie target below a
safe floor is enforced by the planner itself; it plans against whatever
`target_calories` the founder or a clinician supplies.

## Schema

See `supabase/migrations/202607300007_nutrition_toolkit.sql` for full DDL,
RLS policies, and the 24-recipe seed. All five new tables have RLS enabled;
`nutrition_profiles`/`meal_plans`/`meal_plan_items` are owner-scoped
(`auth.uid() = user_id`, all four operations); `recipes`/`recipe_ingredients`
are read-only to `authenticated` with no write grant at all (curated by
migration only).
