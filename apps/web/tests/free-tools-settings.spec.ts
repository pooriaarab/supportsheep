import { expect, test } from "@playwright/test";
import { ensureDashboardPage } from "./helpers";

test("settings tools page renders the free tools catalog", async ({ page }) => {
  await ensureDashboardPage(page, "/settings/tools");

  await expect(page.getByRole("heading", { name: "Free Tools" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seed tools" })).toBeVisible();
  await expect(page.getByLabel("Search tools")).toBeVisible();
});
