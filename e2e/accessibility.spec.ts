import AxeBuilder from "@axe-core/playwright";
import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

// Automated WCAG smoke coverage for the highest-value authenticated areas.
// This does not replace manual keyboard/screen-reader testing, but it catches
// regressions such as missing accessible names, invalid landmarks and common
// contrast failures before a release reaches invited users.
test.describe("Authenticated accessibility smoke (@functional-only)", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    await signInAsTestUser(admin, page, user.email);
    await expect(page).toHaveURL(/\/today/);
  });

  test.afterEach(async ({ admin }) => {
    if (userId) await deleteTestUser(admin, userId);
  });

  test("Today, Coach, Nutrition and Settings have no detectable WCAG A/AA violations", async ({ page }) => {
    test.setTimeout(120_000);
    for (const path of ["/today", "/coach", "/nutrition", "/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations, `${path}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
    }
  });
});
