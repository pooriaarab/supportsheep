import { expect, test } from "@playwright/test";
import { ensureDashboardPage } from "./helpers";

test.describe("Settings navigation", () => {
  test("general nav item opens the knowledge base general settings page", async ({
    page,
  }) => {
    await ensureDashboardPage(page, "/settings/permalinks");

    await page.getByRole("link", { name: "General" }).click();

    await expect(page).toHaveURL(/\/settings\/general$/);
    await expect(
      page.getByRole("heading", { name: "Support Portal Settings" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
