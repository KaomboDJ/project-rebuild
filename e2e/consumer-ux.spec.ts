import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

/**
 * Consumer UX & Visual Maturity release.
 *
 * The desktop projects prove the richer Home/Nutrition hierarchy remains
 * reachable. The phone project additionally proves the deliberately small
 * five-destination dock and its accessible overflow sheet. This file is
 * untagged so the existing Playwright matrix runs it at every real viewport.
 */
test.describe("Consumer navigation and visual hierarchy", () => {
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

  test("Home presents one clear next action and the daily overview", async ({ page }) => {
    await expect(page.getByText("Próxima melhor decisão")).toBeVisible();
    await expect(page.getByText("O teu dia, sem ruído.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver calendário completo" })).toBeVisible();
    await expect(page.getByText("Agenda visual")).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test("Nutrition keeps the four-step journey in one continuous workspace", async ({ page }) => {
    await page.goto("/nutrition");

    await expect(page.getByRole("heading", { name: "O teu sistema alimentar" })).toBeVisible();
    await expect(page.locator("main > section")).toHaveCount(4);
    await expect(page.locator("#profile")).toBeVisible();
    await expect(page.locator("#pantry")).toBeVisible();
    await expect(page.locator("#plan")).toBeVisible();
    await expect(page.locator("#shopping")).toBeVisible();
  });

  test("the mobile dock exposes essentials and More stays keyboard-accessible", async ({
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 1440) >= 768, "Mobile navigation only");

    const navigation = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(navigation.getByRole("link", { name: "Início", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Hoje", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Coach", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Alimentação", exact: true })).toBeVisible();

    const moreButton = navigation.getByRole("button", { name: "Mais opções" });
    await moreButton.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Mais opções" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Treino" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Histórico" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Definições" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(moreButton).toBeFocused();
  });
});
