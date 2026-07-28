# Project Rebuild — Product Backlog

This document captures agreed product opportunities that are intentionally outside the current MVP.

The canonical product vision remains `FOUNDER_CONTEXT.md`.

## Nutrition Toolkit

**Status:** Planned after validation of the core Decision Engine.

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
