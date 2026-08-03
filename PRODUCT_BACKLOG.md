# Project Rebuild — Product Backlog

This document captures agreed product opportunities that are intentionally outside the current MVP.

The canonical product vision remains `FOUNDER_CONTEXT.md`.

## Nutrition Toolkit

**Status:** Built and extended through the Phase 1 completion slice. The canonical current behavior is documented in `docs/13_NUTRITION_TOOLKIT.md` and `docs/19_PHASE_1_HEALTH_COMPLETION.md`; the historical planning text below is retained as product provenance, not as current implementation status.

**2026-07-30 update (Coach UX + Pantry Intelligence milestone):** the founder approved and shipped a founder-pilot-gate override (see `PROJECT_REBUILD_STATE.md` and `docs/12_ROADMAP.md`) that added pantry inventory tracking, a shopping list, and Coach tool-calling against both (`pantry_items`, `inventory_events`, `shopping_lists`, `shopping_list_items`; `/nutrition`, `/nutrition/pantry`, `/nutrition/shopping`). That milestone is deliberately narrower than this Nutrition Toolkit entry: it tracks *what exists at home* and lets the Coach reason over it and propose actions the founder confirms — it does not generate meal plans, estimate macros, or produce shopping lists from a recipe library. This backlog entry (seven-day meal plan, macro estimates, "Decide for me") is the next-next milestone once the shipped pantry foundation and the Founder Pilot's core decision loop are both validated — do not start it without a separate founder decision, the same way this override required one. The shipped pantry data model is a useful input to it when the time comes (e.g. "prefer meals using what's about to expire"), not a substitute for it.

### Product purpose

Remove the recurring effort involved in deciding:

- What to eat.
- How much to prepare.
- What to buy.
- How to keep the week aligned with a nutrition target.

This module should prevent high-risk moments such as having no meal prepared, ordering takeout through fatigue, or under-eating during the day and overeating at night.

### Core experience

The default path is **“Decide for me”**.

The user provides only the minimum necessary information:

- Goal.
- Preferred dietary style.
- Allergies, intolerances, exclusions, and relevant medical constraints.
- Number of meals per day.
- Number of people.
- Available cooking time.
- Budget preference.
- Desired variety.
- Macro targets, when supplied by the user or an appropriate professional.

The system produces:

1. A seven-day meal plan.
2. Meals, recipes, portions, and preparation time.
3. Estimated daily calories and macros.
4. A consolidated shopping list with quantities for seven days.
5. A batch-preparation plan for the week.
6. Simple substitutions when an ingredient is unavailable.

### Planning modes

#### Decide for me

The system builds the complete week with minimal input.

#### Simple rotation

The user selects a small number of breakfasts, lunches, dinners, and snacks to repeat throughout the week.

#### Flexible week

The system provides interchangeable meal options that remain close to the same nutritional target.

### Shopping-list behaviour

The shopping list should:

- Aggregate identical ingredients across all recipes.
- Convert recipe portions into realistic purchase quantities.
- Group items by supermarket section.
- Allow the user to mark ingredients already available at home.
- Recalculate quantities for household size and number of planned days.
- Update automatically when a meal is replaced.
- Avoid listing optional ingredients as mandatory purchases.

### Macro behaviour

- Show estimated daily totals for protein, carbohydrates, fat, fibre, and energy.
- Prefer useful ranges over false precision.
- Clearly distinguish user-provided or clinician-provided targets from system estimates.
- Never present estimated macros as medical advice.
- Avoid extreme calorie deficits or restrictive protocols.

### Decision Engine integration

This module must improve concrete decisions:

- On planning day: “Create my week.”
- Before shopping: “Buy exactly what the plan requires.”
- Before cooking: “Prepare the highest-leverage foods first.”
- Before dinner risk: “Use the meal already assigned and available.”
- When plans change: “Choose the closest practical substitute.”

### Minimum useful version

The first version should support:

- One user.
- Seven days.
- Three meals and an optional snack.
- A small curated meal library.
- Dietary preferences and exclusions.
- Daily macro estimates.
- Consolidated shopping quantities.
- Meal replacement from the same nutritional category.

It should not initially support:

- Grocery-store ordering.
- Barcode scanning.
- Automatic pantry recognition.
- Medical diets without professional oversight.
- Large recipe marketplaces.
- Detailed micronutrient optimization.

### Validation metric

The module succeeds if it reduces:

- Time spent deciding meals.
- Unplanned takeout.
- Missing ingredients.
- Food waste.
- Deviations caused by lack of preparation.

The primary question remains:

> Did the toolkit make the next food decision easier?
