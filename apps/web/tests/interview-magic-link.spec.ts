import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * End-to-end coverage for the magic-link guest entry flow.
 *
 * Scenarios:
 *   1. Happy path — submit email → "check your inbox" → follow captured link
 *      → consent screen → accept → in-call screen renders.
 *   2. Invalid/unknown token — visiting a fake magic-link URL surfaces an
 *      error response (no consent).
 *   3. Already-used token — clicking a consumed link surfaces the consumed
 *      error response (no consent).
 *
 * The outbound email is stubbed by the in-process `sendMagicLinkEmail` helper
 * which, when the `INTERVIEW_MAGIC_LINK_TEST_CAPTURE` env var is set, records
 * the most-recent magic-link URL per email. The test reads it back via
 * `/api/v1/interviews/test-only/magic-link-capture` (test-only endpoint, returns
 * 404 in production).
 */

async function createMagicLinkShareLink(
  request: APIRequestContext,
  topic: string,
): Promise<string> {
  const createRes = await request.post("/api/v1/interviews/share-links", {
    data: {
      type: "link",
      topic,
      style: "smart",
      recordingConfig: "transcript",
      authMode: "magic_link",
      maxDurationSec: 300,
      maxUses: null,
    },
  });
  expect(createRes.ok()).toBe(true);
  const { token } = await createRes.json();
  expect(token).toBeDefined();
  return token as string;
}

async function readCapturedMagicLinkUrl(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.get(
    `/api/v1/interviews/test-only/magic-link-capture?email=${encodeURIComponent(email)}`,
  );
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { url: string };
  expect(body.url).toMatch(/\/api\/v1\/interviews\/magic-link\?share=/);
  return body.url;
}

test.describe("Interview magic-link flow", () => {
  test.beforeAll(async ({ request }) => {
    // Authenticate the request context as admin so share-link creation works.
    const loginRes = await request.post("/api/v1/auth/test-login", {
      data: { email: "dev@example.com" },
    });
    expect(loginRes.ok()).toBe(true);
  });

  test.beforeEach(async ({ page }) => {
    // Guest browsing — start logged out.
    await page.context().clearCookies();
  });

  test("guest submits email, follows captured link, consents, and reaches in-call", async ({
    page,
    request,
  }) => {
    const topic = `Magic Link Happy Path ${Date.now()}`;
    const guestEmail = `magic-${Date.now()}@example.com`;
    const token = await createMagicLinkShareLink(request, topic);

    // 1. Visit landing page — magic-link form is rendered for magic_link mode.
    await page.goto(`/i/${token}`);
    await expect(
      page.getByText("You've been invited to an AI interview"),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(topic)).toBeVisible();
    await expect(page.getByLabel("Your Email Address")).toBeVisible();

    // 2. Submit the magic-link form.
    await page.getByLabel("Your Email Address").fill(guestEmail);
    await page.getByRole("button", { name: "Send magic link" }).click();

    // 3. "Check your inbox" UI is shown.
    await expect(page.getByText("Check your inbox")).toBeVisible();
    await expect(page.getByText(guestEmail)).toBeVisible();

    // 4. Read the captured magic-link URL from the test-only side channel.
    const magicUrl = await readCapturedMagicLinkUrl(request, guestEmail);

    // 5. Stub the OpenAI realtime session minting (called from /consent) so
    //    the test does not depend on outbound provider availability.
    await page.route("**/api/v1/interviews/*/consent", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: {
            value: "stub-openai-secret",
            expires_at: Date.now() + 60_000,
          },
          interviewToken: "stub-interview-token",
          interviewId: "stub-interview-id",
          expiresAt: Date.now() + 60_000,
        }),
      });
    });

    // 6. Follow the magic link — the API GET should redirect to consent.
    await page.goto(magicUrl);
    await expect(page).toHaveURL(/\/i\/.+\/consent\?interview=/);
    await expect(
      page.getByText("Consent and Privacy Agreement"),
    ).toBeVisible({ timeout: 15000 });

    // 7. Accept consent — client redirects to /live with the stubbed tokens.
    await page.getByRole("button", { name: "Accept & Start" }).click();
    await expect(page).toHaveURL(/\/live\?interview=/);
    await expect(page).toHaveURL(/ephemeral=stub-openai-secret/);
    await expect(page).toHaveURL(/itoken=stub-interview-token/);
  });

  test("invalid magic-link token surfaces an error response (no consent)", async ({
    request,
  }) => {
    const token = await createMagicLinkShareLink(
      request,
      `Magic Link Invalid Token ${Date.now()}`,
    );

    // Follow a magic-link URL for the valid share but with a code that was
    // never issued. The redemption endpoint should return 404 and never
    // redirect to consent. Use the API context (does not follow redirects)
    // so we can assert the status precisely.
    const res = await request.get(
      `/api/v1/interviews/magic-link?share=${encodeURIComponent(token)}&code=never-issued-code`,
      { maxRedirects: 0 },
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });

  test("already-used magic-link token surfaces a consumed error on re-click", async ({
    page,
    request,
  }) => {
    const topic = `Magic Link Replay ${Date.now()}`;
    const guestEmail = `magic-replay-${Date.now()}@example.com`;
    const token = await createMagicLinkShareLink(request, topic);

    // 1. Submit the form once so a magic-link doc is created.
    await page.goto(`/i/${token}`);
    await expect(page.getByLabel("Your Email Address")).toBeVisible({
      timeout: 15000,
    });
    await page.getByLabel("Your Email Address").fill(guestEmail);
    await page.getByRole("button", { name: "Send magic link" }).click();
    await expect(page.getByText("Check your inbox")).toBeVisible();

    const magicUrl = await readCapturedMagicLinkUrl(request, guestEmail);

    // 2. First redemption — should redirect to consent (302).
    const firstClick = await request.get(magicUrl, { maxRedirects: 0 });
    expect(firstClick.status()).toBe(302);
    expect(firstClick.headers()["location"]).toContain("/consent?interview=");

    // 3. Second redemption — link is now consumed, should return 409.
    const secondClick = await request.get(magicUrl, { maxRedirects: 0 });
    expect(secondClick.status()).toBe(409);
    const body = await secondClick.json();
    expect(body.error).toBe("consumed");
  });
});
