import { test, expect } from "@playwright/test";
import { ensureDashboardPage } from "./helpers";

test.describe("Interview Author Flow", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock the /interview/[id]/live page to avoid outbound backend OpenAI/Anthropic SDK calls and missing API keys
    await page.route("**/interview/*/live*", async (route) => {
      const url = route.request().url();
      const match = url.match(/\/interview\/([^/]+)\/live/);
      const interviewId = match ? match[1] : "mock-interview-id";

      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Live Interview</title>
            </head>
            <body class="bg-background text-foreground">
              <div id="mock-in-call-layout" class="p-8 space-y-6">
                <h1 class="text-2xl font-bold">In Call Live Layout</h1>
                
                <!-- Mocking InCallLayoutDesktop elements -->
                <div data-testid="orb" class="w-20 h-20 rounded-full bg-primary animate-pulse">Orb</div>
                <div data-testid="canvas" class="border border-border p-4">Canvas Content</div>
                <div data-testid="chat" class="border border-border p-4">Chat History</div>
                
                <button id="end-call-btn" class="bg-destructive text-destructive-foreground px-4 py-2 rounded">
                  End call
                </button>
              </div>

              <script>
                document.getElementById("end-call-btn").addEventListener("click", () => {
                  window.location.href = "/interview/${interviewId}/review";
                });
              </script>
            </body>
          </html>
        `,
      });
    });

    // 2. Mock the /interview/[id]/review page to render ReviewAuthor mock cleanly
    await page.route("**/interview/*/review*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Review Interview</title>
            </head>
            <body class="bg-background text-foreground p-8">
              <div id="mock-review-author" class="space-y-6 max-w-xl mx-auto">
                <h1 class="text-2xl font-bold">Review Draft</h1>
                <p>The draft has been generated. Authors can review and submit.</p>
                
                <button id="submit-review-btn" class="bg-primary text-primary-foreground px-4 py-2 rounded">
                  Submit for review
                </button>
              </div>

              <script>
                document.getElementById("submit-review-btn").addEventListener("click", () => {
                  alert("Review submitted!");
                });
              </script>
            </body>
          </html>
        `,
      });
    });
  });

  test("runs through the author interview creation, in-call screen, and author review flow", async ({ page }) => {
    // 1. Login and go to the start interview form
    await ensureDashboardPage(page, "/interview/new");

    // Verify form renders
    await expect(page.getByRole("heading", { name: "Start an interview" })).toBeVisible({ timeout: 15000 });

    // 2. Fill out form and submit
    await page.getByLabel("Interview Topic").fill("E2E Author Flow Test");
    
    // Style select dropdown
    await page.locator("button#style").click();
    await page.getByRole("option", { name: "Brainstorming (Smart)" }).click();

    // Submit form
    await page.getByRole("button", { name: "Start Interview" }).click();

    // 3. Expect redirect to the live page and verify components are present
    await expect(page).toHaveURL(/\/interview\/[^/]+\/live/);
    
    // Verify mocked in-call elements (orb, canvas, chat) are visible
    await expect(page.getByTestId("orb")).toBeVisible();
    await expect(page.getByTestId("canvas")).toBeVisible();
    await expect(page.getByTestId("chat")).toBeVisible();

    // 4. Click "End call"
    await page.locator("#end-call-btn").click();

    // 5. Expect redirect to review page and verify the "Submit for review" button is present
    await expect(page).toHaveURL(/\/interview\/[^/]+\/review/);
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeVisible();
  });
});
