import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

// Founder report (2026-08-05): "Eu coloquei comida na lista mas a maior
// parte das sugestões não inclui a comida que pus na lista." Root cause:
// lib/nutrition/queries.ts's generateShoppingListForPlan deleted every
// shopping_list_items row on the plan's list before re-inserting freshly
// computed lines - including anything added by hand on
// /nutrition/shopping, since that page always shows whichever
// shopping_lists row was most recently created with status = 'open',
// which becomes the plan-linked list the moment it's generated. Fixed via
// 202608050002_shopping_list_item_source.sql's new `source` column -
// generateShoppingListForPlan now only ever deletes its own previously
// auto-generated lines (source = 'meal_plan').

test.describe("Shopping list item source protection (@functional-only)", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    await signInAsTestUser(admin, page, user.email);
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId);
  });

  test("regenerating the plan's shopping list keeps manually-added items", async ({ page }) => {
    // Generate a week plan and its shopping list once - this is the first
    // write to the plan-linked shopping_lists row.
    const planResponse = await page.request.post("/api/nutrition/plan");
    expect(planResponse.ok()).toBeTruthy();
    const firstListResponse = await page.request.post("/api/nutrition/plan/shopping-list");
    expect(firstListResponse.ok()).toBeTruthy();

    // The founder adds something by hand on the shopping list page - this
    // lands on the very same shopping_lists row (it's "the open list").
    await page.goto("/nutrition/shopping");
    await page.getByPlaceholder("Adicionar à lista (ex.: bananas)").fill("Playwright: item manual");
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Playwright: item manual")).toBeVisible();

    // Regenerate the plan's shopping list a second time (e.g. after
    // replacing a meal) - before the fix, this wiped every item on the
    // list, including the one just added by hand.
    const secondListResponse = await page.request.post("/api/nutrition/plan/shopping-list");
    expect(secondListResponse.ok()).toBeTruthy();

    await page.goto("/nutrition/shopping");
    await expect(page.getByText("Playwright: item manual")).toBeVisible();
  });
});
