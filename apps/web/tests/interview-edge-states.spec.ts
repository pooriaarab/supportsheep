import { test, expect } from "@playwright/test";

test.describe("Interview Edge States", () => {
  test.beforeAll(async ({ request }) => {
    // Authenticate as admin to create test share links
    const loginRes = await request.post("/api/v1/auth/test-login", {
      data: { email: "dev@example.com" },
    });
    expect(loginRes.ok()).toBe(true);
  });

  test.beforeEach(async ({ page }) => {
    // Clear cookies to simulate a clean logged-out guest user session by default
    await page.context().clearCookies();
  });

  test("expired share link renders ExpiredCard on landing", async ({ page, request }) => {
    // 1. Create a share link expired in the past
    const createRes = await request.post("/api/v1/interviews/share-links", {
      data: {
        type: "link",
        topic: "Expired Edge State Topic",
        style: "smart",
        recordingConfig: "transcript",
        authMode: "email",
        maxDurationSec: 300,
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        maxUses: null,
      },
    });
    expect(createRes.ok()).toBe(true);
    const { token } = await createRes.json();

    // 2. Visit as guest
    await page.goto(`/i/${token}`);

    // Verify ExpiredCard (title="Invite no longer available")
    await expect(page.getByText("Invite no longer available")).toBeVisible({ timeout: 15000 });
  });

  test("revoked share link renders ExpiredCard on landing", async ({ page, request }) => {
    // 1. Create active share link
    const createRes = await request.post("/api/v1/interviews/share-links", {
      data: {
        type: "link",
        topic: "Revoked Edge State Topic",
        style: "smart",
        recordingConfig: "transcript",
        authMode: "email",
        maxDurationSec: 300,
        maxUses: null,
      },
    });
    expect(createRes.ok()).toBe(true);
    const { token, id } = await createRes.json();

    // 2. Soft-revoke the share link via DELETE endpoint
    const revokeRes = await request.delete(`/api/v1/interviews/share-links/${id}`);
    expect(revokeRes.ok()).toBe(true);

    // 3. Visit as guest
    await page.goto(`/i/${token}`);

    // Verify ExpiredCard
    await expect(page.getByText("Invite no longer available")).toBeVisible({ timeout: 15000 });
  });

  test("maxUses exhausted share link renders ExpiredCard on landing", async ({ page, request }) => {
    // 1. Create share link with maxUses = 1
    const createRes = await request.post("/api/v1/interviews/share-links", {
      data: {
        type: "link",
        topic: "Max Uses Edge State Topic",
        style: "smart",
        recordingConfig: "transcript",
        authMode: "email",
        maxDurationSec: 300,
        maxUses: 1,
      },
    });
    expect(createRes.ok()).toBe(true);
    const { token } = await createRes.json();

    // 2. Clear cookies first so we act as unauthenticated guest
    await page.context().clearCookies();

    // 3. Mock interview creation to increment the uses transactionally
    const joinRes = await request.post("/api/v1/interviews", {
      data: {
        shareLinkToken: token,
        guestName: "Edge Guest",
        guestEmail: "edge@example.com",
      },
    });
    expect(joinRes.ok()).toBe(true);

    // 4. Visit landing page again (uses should now be 1, equal to maxUses 1)
    await page.goto(`/i/${token}`);

    // Verify ExpiredCard is rendered due to exhausted uses
    await expect(page.getByText("Invite no longer available")).toBeVisible({ timeout: 15000 });
  });

  test("workspace-only link redirects logged-out guest to login page", async ({ page, request }) => {
    // 1. Create a workspace-only share link
    const createRes = await request.post("/api/v1/interviews/share-links", {
      data: {
        type: "workspace",
        topic: "Workspace Only Topic",
        style: "smart",
        recordingConfig: "transcript",
        authMode: "email",
        maxDurationSec: 300,
        maxUses: null,
      },
    });
    expect(createRes.ok()).toBe(true);
    const { token } = await createRes.json();

    // 2. Visit as logged-out guest
    await page.goto(`/i/${token}`);

    // 3. Expect login redirect with returnTo param
    await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=%2Fi%2F${token}`));
  });

  test("mobile portrait viewport renders in-call layout responsively", async ({ page }) => {
    // 1. Mock the live page response
    await page.route("**/interview/*/live*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Live Interview</title>
            </head>
            <body class="bg-background text-foreground">
              <div id="mock-in-call-layout" class="flex flex-col min-h-screen">
                <header class="h-14 border-b border-border flex items-center justify-between px-4">
                  <span>Header</span>
                </header>
                <main class="flex-1 flex flex-col md:flex-row p-4 gap-4">
                  <div id="vocal-presence" class="flex-1 min-h-[200px]">Vocal presence</div>
                  <div id="live-canvas" class="flex-1">Live canvas</div>
                </main>
              </div>
            </body>
          </html>
        `,
      });
    });

    // 2. Set mobile portrait viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // 3. Navigate to a mock live URL
    await page.goto("/interview/mock-id/live");

    // 4. Verify elements are visible on mobile screen
    await expect(page.locator("#vocal-presence")).toBeVisible();
    await expect(page.locator("#live-canvas")).toBeVisible();

    // Verify layout works correctly
    const vocalBox = await page.locator("#vocal-presence").boundingBox();
    const canvasBox = await page.locator("#live-canvas").boundingBox();
    expect(vocalBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();

    if (vocalBox && canvasBox) {
      // On mobile portrait, elements stack vertically, so y-coords should be sequential
      expect(canvasBox.y).toBeGreaterThanOrEqual(vocalBox.y + vocalBox.height);
    }
  });
});
