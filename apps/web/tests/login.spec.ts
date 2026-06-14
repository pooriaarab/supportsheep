import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders the login page", async ({ page }) => {
    await page.goto("/login");

    // The page should load without errors
    await expect(page).toHaveURL(/\/login/);
  });

  test("displays a sign-in heading or form", async ({ page }) => {
    await page.goto("/login");

    // Look for common login page elements
    const heading = page.getByRole("heading", { level: 1 });
    const emailInput = page.getByRole("textbox", { name: /email/i });

    // At least one login indicator should be present
    const hasHeading = (await heading.count()) > 0;
    const hasEmailInput = (await emailInput.count()) > 0;

    expect(hasHeading || hasEmailInput).toBe(true);
  });
});
