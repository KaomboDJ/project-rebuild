import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

// UX Hardening release (docs/17_UX_AUDIT.md, J1 - confirmed P1). The original
// audit found that a fresh Tab from the top of /today visited the entire
// calendar toolbar, every calendar event link, and all three decision
// cards' buttons (roughly two dozen stops) before ever reaching primary
// navigation, which sits visually first on every screen. This test pins
// down the fix: a skip link as the very first stop, and primary nav
// reachable within a handful of presses after it.

test.describe("Keyboard navigation on /today (@functional-only)", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    await signInAsTestUser(admin, page, user.email);
    await expect(page).toHaveURL(/\/today/);
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId);
  });

  test("the skip link is the first Tab stop and jumps to the main content", async ({ page }) => {
    // A fresh document starts with <body> as the active element. Clicking
    // the page first is not equivalent: it can leave a previously focused
    // control active in Chromium and made this assertion order-dependent.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar para o conteúdo" })).toBeFocused();

    await page.keyboard.press("Enter");
    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("main-content");
  });

  test("primary navigation is reachable within the first few Tab presses", async ({ page }) => {
    await page.locator("body").click({ position: { x: 5, y: 5 } });

    const navLabels = ["Hoje", "Coach", "Alimentação", "Histórico", "Definições"];
    let sawNavLink = false;

    // Skip link (1) + logo (2) + up to 5 nav links (3-7) - a generous 10-tab
    // budget is still an order of magnitude tighter than the ~24 stops the
    // original bug required, and catches a regression back to "nav is last".
    for (let i = 0; i < 10 && !sawNavLink; i += 1) {
      await page.keyboard.press("Tab");
      const text = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
      if (navLabels.includes(text)) sawNavLink = true;
    }

    expect(sawNavLink).toBe(true);
  });

  test("reverse (Shift+Tab) navigation follows the primary-nav order without trapping focus", async ({ page }) => {
    // Start from a known control instead of assuming that an arbitrary 40
    // forward Tabs reached the end of a page whose decisions are dynamic.
    // Moving backward from Settings must reach History, proving reverse
    // keyboard navigation through the primary navigation is ordered and
    // not trapped by the calendar workspace.
    const settingsLink = page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", {
      name: "Definições",
    });
    await settingsLink.focus();
    await expect(settingsLink).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Histórico" })
    ).toBeFocused();
  });
});
