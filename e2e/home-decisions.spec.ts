import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

test.describe("Home planning and Decisions execution (@functional-only)", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    await signInAsTestUser(admin, page, user.email);
    await page.goto("/home");
  });

  test.afterEach(async ({ admin }) => {
    if (userId) await deleteTestUser(admin, userId);
  });

  test("Home is the first navigation destination and owns day planning", async ({ page }) => {
    const navigation = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(navigation.getByRole("link", { name: "Início", exact: true })).toHaveAttribute("href", "/home");
    await expect(page.getByRole("link", { name: "Ver calendário completo" })).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: "Planear o meu dia" })
        .or(page.getByText(/plano (proposto|confirmado|em dia)/i))
    ).toBeVisible();
  });

  test("Decisions links back to Home instead of owning the batch planning action", async ({ page }) => {
    await page.goto("/today");

    await expect(page.getByRole("button", { name: "Programar o meu dia" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /planear no início|rever e confirmar|ver plano completo/i })).toBeVisible();
  });
});
