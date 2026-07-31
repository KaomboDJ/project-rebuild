import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// UX Hardening release (docs/17_UX_AUDIT.md, section 5 - "complete the
// testing gaps properly"). Real browser/viewport emulation via Playwright,
// replacing the previous audit's browser-extension `resize_window` tool,
// which never actually changed the rendered CSS viewport (confirmed via
// window.innerWidth staying fixed regardless of the requested size - see
// docs/17_UX_AUDIT.md §6). Playwright's `viewport` option genuinely resizes
// the page, so the four breakpoints named in the release brief are real
// projects here, not a repeated claim.
//
// `webServer` starts the app's own dev server for the test run rather than
// requiring one to already be running - `reuseExistingServer` is true only
// outside CI so a local `npm run dev` already open isn't fought over.

// Playwright's config runs as a plain Node process, outside Next's own
// automatic .env.local loading - a minimal inline parser here (rather than
// pulling in the `dotenv` package) is enough to make
// NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY visible to e2e/fixtures.ts.
function loadDotEnvLocal(): void {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadDotEnvLocal();

const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // fixtures create/delete real Supabase auth users - safer serialized than racing admin API calls.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "laptop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
      grepInvert: /@functional-only/,
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
      grepInvert: /@functional-only/,
    },
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
      grepInvert: /@functional-only/,
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
