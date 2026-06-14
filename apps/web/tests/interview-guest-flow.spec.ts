import { test, expect } from "@playwright/test";

test.describe("Interview Guest Flow", () => {
  let activeToken: string;

  test.beforeAll(async ({ request }) => {
    // 1. Login programmatically as admin to create active share link
    const loginRes = await request.post("/api/v1/auth/test-login", {
      data: { email: "dev@example.com" },
    });
    expect(loginRes.ok()).toBe(true);

    const createRes = await request.post("/api/v1/interviews/share-links", {
      data: {
        type: "link",
        topic: "Guest Flow Test Topic",
        style: "smart",
        recordingConfig: "transcript",
        authMode: "email",
        maxDurationSec: 300,
        maxUses: null,
      },
    });
    expect(createRes.ok()).toBe(true);
    const body = await createRes.json();
    activeToken = body.token;
    expect(activeToken).toBeDefined();
  });

  test.beforeEach(async ({ page }) => {
    // Clear cookies to simulate a clean logged-out guest user session
    await page.context().clearCookies();

    // Stub RTCPeerConnection to prevent WebRTC crashes/outbound calls
    await page.addInitScript(() => {
      class MockRTCPeerConnection {
        localDescription = { type: "offer", sdp: "mock-sdp" };
        remoteDescription = { type: "answer", sdp: "mock-sdp" };
        signalingState = "stable";
        iceConnectionState = "connected";
        iceGatheringState = "complete";
        
        createOffer() {
          return Promise.resolve({ type: "offer", sdp: "mock-sdp" });
        }
        setLocalDescription() {
          return Promise.resolve();
        }
        setRemoteDescription() {
          return Promise.resolve();
        }
        addIceCandidate() {
          return Promise.resolve();
        }
        createAnswer() {
          return Promise.resolve({ type: "answer", sdp: "mock-sdp" });
        }
        addTransceiver() {
          return { direction: "sendrecv" };
        }
        close() {}
        addEventListener() {}
        removeEventListener() {}
      }
      // @ts-expect-error - MockRTCPeerConnection is a simplified mock class for testing
      window.RTCPeerConnection = MockRTCPeerConnection;
    });

    // Block/mock outbound OpenAI and Anthropic API calls at browser layer
    await page.route("**/api.openai.com/**", (route) => route.fulfill({ status: 200, body: "{}" }));
    await page.route("**/api.anthropic.com/**", (route) => route.fulfill({ status: 200, body: "{}" }));
  });

  test("runs through the active guest email flow and consent screen", async ({ page }) => {
    // 1. Visit the guest landing URL
    await page.goto(`/i/${activeToken}`);

    // Verify topic + duration disclosure on LandingCard
    await expect(page.getByText("You've been invited to an AI interview")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Guest Flow Test Topic")).toBeVisible();
    await expect(page.getByText("~5 minutes")).toBeVisible();

    // Mock API requests for interview creation and consent to avoid outbound OpenAI Realtime token minting
    await page.route("**/api/v1/interviews", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          interviewId: "mock-guest-interview-id",
          status: "consent",
        }),
      });
    });

    await page.route("**/api/v1/interviews/*/consent", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_secret: { value: "mock-openai-session-secret", expires_at: Date.now() + 60000 },
          interviewToken: "mock-interview-hmac-token",
          interviewId: "mock-guest-interview-id",
          expiresAt: Date.now() + 60000,
        }),
      });
    });

    // 2. Mock email gate path: fill out name + email and submit
    await page.getByLabel("Your Name").fill("Jane Doe");
    await page.getByLabel("Your Email").fill("jane@example.com");
    await page.getByRole("button", { name: "Continue to interview" }).click();

    // 3. Expect redirect to the consent page
    await expect(page).toHaveURL(/consent/);
    await expect(page.getByText("Consent and Privacy Agreement")).toBeVisible();

    // 4. Consent page: click accept -> expect redirect to live page with parameters
    await page.getByRole("button", { name: "Accept & Start" }).click();

    await expect(page).toHaveURL(/live/);
    await expect(page).toHaveURL(/interview=mock-guest-interview-id/);
    await expect(page).toHaveURL(/ephemeral=mock-openai-session-secret/);
    await expect(page).toHaveURL(/itoken=mock-interview-hmac-token/);
  });

  test("renders ExpiredCard for invalid or expired tokens", async ({ page }) => {
    // Visit a non-existent token (length must be at least 32 to satisfy token hash resolve check)
    const invalidToken = "abcdefghijklmnopqrstuvwxyz123456";
    await page.goto(`/i/${invalidToken}`);

    // Verify ExpiredCard renders
    await expect(page.getByText("Invite no longer available")).toBeVisible({ timeout: 15000 });
  });
});
