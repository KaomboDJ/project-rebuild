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

  test("Hoje shows an already-generated plan without the check-in gate", async ({ page }) => {
    // Regression for the live bug found in a founder walkthrough: Início
    // and Hoje disagreed about whether today was planned because Hoje
    // gated its *entire* workspace behind hasCheckIn, ignoring decisions
    // that already existed (e.g. from the overnight cron). Generating
    // decisions first (as the cron would) and visiting /today with no
    // check-in yet must show the real plan, not the blocking check-in
    // screen - and submitting a check-in afterwards must never be forced
    // just to see today's plan.
    const generateResponse = await page.request.post("/api/decisions/generate");
    expect(generateResponse.ok()).toBeTruthy();

    await page.goto("/today");

    await expect(page.getByText("O teu dia ainda não foi planeado.")).toHaveCount(0);
    await expect(page.getByText("Ainda sem check-in hoje.")).toBeVisible();
  });
});
