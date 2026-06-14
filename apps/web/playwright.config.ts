/**
 * Playwright Configuration
 *
 * E2E testing configuration for the web application.
 *
 * Setup:
 * 1. Install: bun add -D @playwright/test
 * 2. Install browsers: bunx playwright install
 * 3. Run tests: bunx playwright test
 * 4. Run with UI: bunx playwright test --ui
 * 5. View report: bunx playwright show-report
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || 3000;
const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${PORT}`;

export default defineConfig({
  // Test directory
  testDir: "./tests",

  // Maximum time one test can run for
  timeout: 30 * 1000,

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [["html"], ["list"]],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: BASE_URL,

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "retain-on-failure",
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  // Run your local dev server before starting the tests.
  // In CI, the build is run as a separate step before Playwright, so we only
  // start the production server here (fast cold start). Locally, we use the
  // dev server with hot reload.
  webServer: {
    command: process.env.CI
      ? `DEV_AUTH_BYPASS=true DEV_AUTH_EMAIL=dev@example.com INTERVIEW_MAGIC_LINK_TEST_CAPTURE=true NEXT_PUBLIC_APP_URL=${BASE_URL} bun run start`
      : `DEV_AUTH_BYPASS=true DEV_AUTH_EMAIL=dev@example.com INTERVIEW_MAGIC_LINK_TEST_CAPTURE=true NEXT_PUBLIC_APP_URL=${BASE_URL} bun run dev`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
