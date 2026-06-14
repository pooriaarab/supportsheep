/**
 * Playwright config for the deploy-preview interview matrix.
 *
 * Differs from the main `playwright.config.ts` in three ways:
 *
 *   1. No `webServer` block — we run against a live deploy preview, not
 *      a locally-spawned `next dev` / `next start`.
 *   2. `testMatch` is scoped to the matrix spec so this config doesn't
 *      accidentally pull in any other test file.
 *   3. `baseURL` is sourced exclusively from `DEPLOY_PREVIEW_URL` (set
 *      by the CI workflow) — if missing, fails fast at config-load
 *      time so the workflow's skip path is the only quiet route.
 */

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.DEPLOY_PREVIEW_URL;

if (!BASE_URL) {
  throw new Error(
    "DEPLOY_PREVIEW_URL is not set. This config is only intended for CI runs against a deploy preview.",
  );
}

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/deploy-preview-interview-matrix.spec.ts"],

  timeout: 60 * 1000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
