import { test, expect } from "@playwright/test";
import { ensureDashboardPage } from "./helpers";

test.describe("Permalink settings", () => {
  test("renders the permalink settings page with the root pattern selected", async ({
    page,
  }) => {
    await ensureDashboardPage(page, "/settings/permalinks");

    await expect(
      page.getByRole("heading", { name: "Permalink Settings" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("combobox").first(),
    ).toContainText("/ideas-for-personal-websites/", {
      timeout: 15_000,
    });
  });
});
