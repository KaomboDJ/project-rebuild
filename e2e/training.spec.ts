import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

// Task #145 (docs/IMPLEMENTATION_STATUS.md gap analysis, 2026-08-05): the
// Training Toolkit (Milestone 15) shipped with only unit tests at the
// logic level (lib/training/planner.test.ts, reasoning.test.ts) - nothing
// exercised the actual /training and /training/profile pages end-to-end,
// unlike most other domains in this suite. Mirrors
// shopping-list-source.spec.ts's pattern: seed data via the real API
// (page.request.post), then assert on the rendered UI.
//
// e2e/fixtures.ts's MINIMAL_PROFILE sets preferred_training_days to
// ["monday", "wednesday", "friday"] - lib/training/planner.ts's
// generateWeekTrainingPlan only plans a session on days actually present
// in that list (every other day is a rest day, never a placeholder), so a
// freshly generated plan for this fixture always has exactly 3 planned
// items, regardless of which real calendar week the test happens to run
// in. Every assertion below relies on that count rather than hard-coded
// dates, so this suite doesn't go stale as time passes.

test.describe("Training Toolkit (@functional-only)", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    await signInAsTestUser(admin, page, user.email);
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId);
  });

  test("shows the no-plan-yet hint and a link to the training profile before any plan exists", async ({ page }) => {
    await page.goto("/training");
    await expect(page.getByRole("heading", { name: "Plano da semana" })).toBeVisible();
    await expect(page.getByText("Ainda sem plano de treino esta semana")).toBeVisible();
    // No training_profiles row has been saved yet (only the nutrition-style
    // MINIMAL_PROFILE fixture exists) - hasProfile is false, so the page
    // should point at /training/profile rather than just "usa Gerar plano".
    const profileLink = page.getByRole("link", { name: "perfil de treino" });
    await expect(profileLink).toBeVisible();
    await expect(profileLink).toHaveAttribute("href", "/training/profile");
  });

  test("saves a training profile from /training/profile", async ({ page }) => {
    await page.goto("/training/profile");
    await expect(page.getByRole("button", { name: "Guardar perfil" })).toBeVisible();

    // Mark one training category so preferredCategories is no longer empty
    // - candidatesForTrainingDay's hard filter (never relaxed) then
    // requires this to actually round-trip correctly, unlike the "no
    // filter, use every category" default.
    await page.getByRole("button", { name: "Calistenia", exact: true }).click();
    await page.getByLabel("Duração habitual da sessão (min)").fill("30");
    await page.getByLabel(/Limitações físicas relevantes/).fill("Playwright: joelho sensível");

    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByText("Perfil de treino guardado.")).toBeVisible();

    // Reload and confirm the save actually persisted server-side, not just
    // optimistic client state.
    await page.reload();
    await expect(page.getByRole("button", { name: "Calistenia", exact: true })).toHaveClass(/emerald/);
    await expect(page.getByLabel("Duração habitual da sessão (min)")).toHaveValue("30");
    await expect(page.getByLabel(/Limitações físicas relevantes/)).toHaveValue("Playwright: joelho sensível");
  });

  test("generates a week's training plan with exactly the 3 fixture training days planned", async ({ page }) => {
    const planResponse = await page.request.post("/api/training/plan");
    expect(planResponse.ok()).toBeTruthy();
    const body = await planResponse.json();
    expect(body.items).toHaveLength(3); // monday, wednesday, friday - see file header comment

    await page.goto("/training");
    await expect(page.getByText("Plano de treino desta semana")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como feita" })).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Saltar" })).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Substituir" })).toHaveCount(3);
    // Every planned card names a real session and its approximate duration.
    await expect(page.getByText(/^≈\d+ min$/).first()).toBeVisible();
  });

  test("marks a planned session done, and it renders as completed", async ({ page }) => {
    const planResponse = await page.request.post("/api/training/plan");
    expect(planResponse.ok()).toBeTruthy();

    await page.goto("/training");
    await page.getByRole("button", { name: "Marcar como feita" }).first().click();

    await expect(page.getByText(/· feito$/).first()).toBeVisible();
    // A completed item loses its action buttons (TrainingPlanView only
    // renders them for status === "planned") - one fewer of each now.
    await expect(page.getByRole("button", { name: "Marcar como feita" })).toHaveCount(2);
  });

  test("skips a planned session, and it renders struck through", async ({ page }) => {
    const planResponse = await page.request.post("/api/training/plan");
    expect(planResponse.ok()).toBeTruthy();

    await page.goto("/training");
    const firstNameLocator = page.locator(".surface-card p.truncate").first();
    const skippedName = await firstNameLocator.textContent();
    await page.getByRole("button", { name: "Saltar" }).first().click();

    await expect(page.getByText(skippedName ?? "", { exact: true })).toHaveClass(/line-through/);
    await expect(page.getByRole("button", { name: "Saltar" })).toHaveCount(2);
  });

  test('"Porquê esta sessão?" reveals plain-language reasoning sentences', async ({ page }) => {
    const planResponse = await page.request.post("/api/training/plan");
    expect(planResponse.ok()).toBeTruthy();

    await page.goto("/training");
    await page.getByText("Porquê esta sessão?").first().click();
    // explainSessionChoice always returns at least one sentence for a
    // resolved session (lib/training/reasoning.ts) - assert the disclosure
    // actually expanded rather than asserting specific wording, which
    // depends on which of the 29 seeded sessions was picked.
    const details = page.locator("details", { hasText: "Porquê esta sessão?" }).first();
    await expect(details).toHaveAttribute("open", "");
  });
});
