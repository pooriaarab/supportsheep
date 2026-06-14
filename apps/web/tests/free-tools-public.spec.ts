import { expect, test } from "@playwright/test";

test("public tools pages render enabled tools and bottom callouts", async ({
  page,
}) => {
  await page.goto("/tools");
  await expect(page.getByRole("heading", { name: "Free Tools" })).toBeVisible();

  await page.goto("/tools/word-counter");
  await expect(
    page.getByRole("heading", { name: "Word Counter" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze text" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Try Supportsheep" })).toHaveAttribute(
    "href",
    /utm_source=supportsheep_blog/,
  );
});

test("barcode generator renders a visual result with result actions", async ({
  page,
}) => {
  await page.route(
    "**/api/v1/free-tools/public/barcode-generator/run",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            result: {
              kind: "text",
              summary: "Generated SVG barcode-style asset",
              text: '<svg xmlns="http://www.w3.org/2000/svg" width="190" height="110" viewBox="0 0 190 110"><rect width="190" height="110" fill="white" /><rect x="10" y="10" width="3" height="72" /></svg>',
            },
          },
        }),
      }),
  );

  await page.goto("/tools/barcode-generator");
  await page.getByLabel("Barcode value").fill("BLOGBAT-12345");
  const runButton = page.getByRole("button", { name: "Run tool" });
  await expect(runButton).toBeEnabled();
  await runButton.click();

  const barcodePreview = page.locator('[data-barcode-preview="true"]');
  await expect(barcodePreview).toBeVisible();
  await expect(barcodePreview.locator("svg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy result" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download result" }),
  ).toBeVisible();
  await expect(page.getByText("<svg")).toHaveCount(0);
});
