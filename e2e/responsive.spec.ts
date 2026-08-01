import { test, expect, createTestUser, deleteTestUser, signInAsTestUser, completeTodayCheckIn } from "./fixtures";

// UX Hardening release (docs/17_UX_AUDIT.md, section 6 - mobile findings).
// Deliberately untagged so playwright.config.ts runs this file on all four
// projects (1440x900, 1280x720, 768x1024, 390x844) via real Playwright
// viewport emulation - the previous audit could not produce this at all
// (the browser extension's resize_window tool never changed the actual
// rendered viewport, confirmed via window.innerWidth staying fixed
// regardless of the requested size).

test.describe("Responsive layout across breakpoints", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    await completeTodayCheckIn(admin, user.id);
    await signInAsTestUser(admin, page, user.email);
    await expect(page).toHaveURL(/\/today/);
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId);
  });

  test("navigation has no horizontal overflow at this viewport", async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // A small allowance for scrollbars/subpixel rounding, not a real overflow.
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test("the Coach drawer/page remains usable at this viewport", async ({ page }) => {
    await page.goto("/coach");
    await expect(page.getByPlaceholder("Escreve aqui...")).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test("the Home plan and Decisions execution controls stay reachable", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver calendário completo" })).toBeVisible();

    await page.goto("/today");
    const decisionsTab = page.getByRole("button", { name: "Decisões", exact: true });
    if (await decisionsTab.isVisible()) {
      // Phone and tablet widths collapse to a tab switcher between calendar
      // and decisions; wide desktop displays both panels side by side.
      await decisionsTab.click();
    }
    await expect(
      page
        .getByRole("button", { name: "Regenerar" })
        .or(page.getByRole("button", { name: "Gerar as decisões de hoje" }))
        .or(page.getByRole("link", { name: /plano/i }))
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Programar o meu dia" })).toHaveCount(0);
  });
});
