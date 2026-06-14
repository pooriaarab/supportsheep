import { test, expect } from "@playwright/test";
import { ensureDashboardPage } from "./helpers";

test.describe("Interview Share Link Flow", () => {
  test("creates, views, and revokes a share link", async ({ page }) => {
    // 1. Login as admin and navigate to share links page
    await ensureDashboardPage(page, "/interview/links");

    // Verify page title / heading is loaded
    await expect(page.getByRole("heading", { name: "Interview share links" })).toBeVisible({ timeout: 15000 });

    // 2. Click "Create Link" button
    await page.getByRole("button", { name: "Create Link" }).click();

    // Verify quick-create dialog is visible
    await expect(page.getByText("Quick create share link")).toBeVisible();

    // 3. Enter topic and submit
    const testTopic = `Test interview ${Date.now()}`;
    await page.locator("input#topic").fill(testTopic);
    await page.getByRole("button", { name: "Create & copy URL" }).click();

    // Verify toast shows success
    await expect(page.getByText(/copied|created/i)).toBeVisible();

    // 4. Verify new row appears in DataTable
    const linkInTable = page.getByRole("link", { name: testTopic });
    await expect(linkInTable).toBeVisible({ timeout: 10000 });

    // 5. Click row -> detail page renders
    await linkInTable.click();

    // Verify configuration summary on detail page
    await expect(page.getByText(testTopic)).toBeVisible();
    await expect(page.getByText(/Interview Configuration/i)).toBeVisible();
    await expect(page.getByText(/Validity & Access/i)).toBeVisible();

    // 6. Click "Revoke" -> ConfirmDialog -> confirm -> verify status -> "Revoked"
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("Revoke Share Link")).toBeVisible();
    await page.getByRole("button", { name: "Revoke link" }).click();

    // Verify toast or status is updated to revoked
    await expect(page.getByText("Share link revoked")).toBeVisible();
    await expect(page.getByText(/Status: revoked/i)).toBeVisible();
  });

  test("bulk-revokes multiple share links", async ({ page }) => {
    await ensureDashboardPage(page, "/interview/links");
    await expect(page.getByRole("heading", { name: "Interview share links" })).toBeVisible({ timeout: 15000 });

    // Ensure we have at least 2 share links by creating them
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Create Link" }).click();
      await page.locator("input#topic").fill(`Bulk test ${i} ${Date.now()}`);
      await page.getByRole("button", { name: "Create & copy URL" }).click();
      await expect(page.getByText(/copied|created/i)).toBeVisible();
      // Dismiss toast or wait for it to fade
      await page.getByText(/copied|created/i).waitFor({ state: "hidden" }).catch(() => {});
    }

    // Wait for the table to have at least 2 rows (condition-based, not time-based)
    const checkboxes = page.getByRole("checkbox", { name: "Select row" });
    await expect.poll(() => checkboxes.count()).toBeGreaterThanOrEqual(2);
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    // BottomBulkActionsBar should appear. Click Actions / Open command menu
    await page.getByLabel("Open command menu").click();

    // Click "Revoke" inside the bulk dialog
    await expect(page.getByText("Revoke Share Links")).toBeVisible();
    await page.getByRole("button", { name: "Revoke" }).click();

    // Verify success toast
    await expect(page.getByText(/Revoked 2 share links/i)).toBeVisible();
  });
});
