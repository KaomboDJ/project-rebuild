import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

// UX Hardening release (docs/17_UX_AUDIT.md, N2 confirmed P1; N1/N3
// confirmed P2). Seeds pantry rows directly via the admin client (isolated
// test data, never the founder's real pantry) with a deliberate mix of
// zero- and positive-quantity items, then asserts the dashboard shows two
// distinct, correctly labeled counts instead of one ambiguous figure.

test.describe("Pantry count semantics and locale (@functional-only)", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;

    await admin.from("pantry_items").insert([
      { user_id: user.id, name: "Playwright: arroz", quantity: 2, unit: "kg", category: "grain" },
      { user_id: user.id, name: "Playwright: frango", quantity: 1, unit: "unidade", category: "protein" },
      { user_id: user.id, name: "Playwright: leite (acabou)", quantity: 0, unit: "l", category: "dairy" },
    ]);

    await signInAsTestUser(admin, page, user.email);
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId);
  });

  test("the dashboard shows total registered and currently-available as two distinct, labeled counts", async ({ page }) => {
    await page.goto("/nutrition");
    // 2 of the 3 seeded items have quantity > 0.
    await expect(page.getByText("2 itens disponíveis agora")).toBeVisible();
    await expect(page.getByText("3 itens registados no total")).toBeVisible();
    // The old ambiguous, ungrammatical string must not reappear.
    await expect(page.getByText("item(ns)")).toHaveCount(0);
  });

  test("the Coach's context panel reports the same available count, correctly pluralized", async ({ page }) => {
    await page.goto("/coach");
    await expect(page.getByText(/Despensa \(disponível agora\):\s*2 itens/)).toBeVisible();
  });

  test("pantry quantities show a space between the number and the unit", async ({ page }) => {
    await page.goto("/nutrition/pantry");
    await expect(page.getByText("2 kg")).toBeVisible();
    await expect(page.getByText("1 unidade")).toBeVisible();
    // The "0unidade"-style bug concatenated the number and unit with no
    // space at all - assert that pattern is gone from the whole page.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\d(kg|unidade|l)\b/);
  });

  test("allergy options are shown in Portuguese, not the stored English keys", async ({ page }) => {
    await page.goto("/nutrition/profile");
    await expect(page.getByRole("button", { name: "Glúten" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marisco" })).toBeVisible();
    await expect(page.getByRole("button", { name: "eggs", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "shellfish", exact: true })).toHaveCount(0);
  });
});
