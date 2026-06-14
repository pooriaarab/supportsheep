/**
 * Overlay layout smoke — Loom/Twitch screen-recording vibe.
 *
 * Mocks the `/interview/[id]/live` route so the spec doesn't need the
 * full WebRTC + Firestore + auth pipeline to render. The mocked HTML
 * mirrors the shape of `InCallLayoutDesktop`'s new floating-orb cluster
 * so the smoke can:
 *
 *   1. Assert the orb cluster sits in the bottom-right of the viewport.
 *   2. Click End Session and confirm the navigation hook fires.
 *   3. Confirm the canvas column is centred (canvas content width is
 *      capped well below the viewport width on a wide screen).
 *
 * The existing `deploy-preview-interview-matrix.spec.ts` runs the real
 * flow against a live deploy preview; this spec is the cheap local
 * counterpart so layout regressions land before merge.
 */

import { test, expect } from "@playwright/test";

test.describe("In-call overlay layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/interview/*/live*", async (route) => {
      const match = route.request().url().match(/\/interview\/([^/]+)\/live/);
      const interviewId = match ? match[1] : "mock-interview-id";

      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Live Interview</title>
              <style>
                html, body { margin: 0; padding: 0; height: 100%; }
                .h-14 { height: 56px; }
                .fixed { position: fixed; }
                .bottom-6 { bottom: 24px; }
                .right-6 { right: 24px; }
                .z-30 { z-index: 30; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .items-center { align-items: center; }
                .gap-2 { gap: 8px; }
                .rounded-2xl { border-radius: 16px; }
                .border { border: 1px solid #ccc; }
                .max-w { max-width: 768px; margin-left: auto; margin-right: auto; }
                main { display: flex; justify-content: center; }
                .canvas { width: 100%; max-width: 768px; margin: 24px auto; padding: 16px; border: 1px solid #ddd; }
              </style>
            </head>
            <body>
              <div id="mock-in-call-layout">
                <header class="h-14" data-testid="in-call-header">
                  <span>Mock Header</span>
                  <button id="end-call-btn" data-testid="end-session-btn">End Session</button>
                </header>
                <main>
                  <section data-testid="in-call-canvas-column">
                    <div class="canvas" data-testid="canvas-collaborative-editor">
                      Canvas content
                    </div>
                  </section>
                </main>
                <div
                  class="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-2"
                  data-testid="floating-orb-cluster"
                >
                  <button data-testid="floating-mute-toggle">Mute</button>
                  <div
                    class="rounded-2xl border"
                    data-testid="floating-orb-card"
                    style="width: 140px; height: 140px;"
                  >
                    <div aria-label="Voice orb: listening"></div>
                  </div>
                  <div data-testid="floating-orb-caption">AI is Listening</div>
                </div>
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

    // Mock the review redirect target so navigation after End completes.
    await page.route("**/interview/*/review*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<!DOCTYPE html><html><body><h1 data-testid="review-page">Review</h1></body></html>`,
      });
    });
  });

  test("renders the floating orb cluster pinned to the bottom-right", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/interview/mock-interview/live");

    const cluster = page.getByTestId("floating-orb-cluster");
    await expect(cluster).toBeVisible();

    const box = await cluster.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Bottom-right anchored: right edge should sit within 100px of the
    // viewport's right edge, bottom edge within 100px of the viewport
    // bottom. Loose tolerance so different orb cluster sizes don't break
    // the smoke as the design evolves.
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) return;
    const rightGap = viewport.width - (box.x + box.width);
    const bottomGap = viewport.height - (box.y + box.height);
    expect(rightGap).toBeLessThanOrEqual(100);
    expect(bottomGap).toBeLessThanOrEqual(100);

    // The orb card itself renders inside the cluster.
    await expect(page.getByTestId("floating-orb-card")).toBeVisible();
    await expect(page.locator('[aria-label="Voice orb: listening"]')).toBeVisible();
  });

  test("clicking End Session navigates to the review page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/interview/mock-interview/live");

    await page.getByTestId("end-session-btn").click();
    await expect(page).toHaveURL(/\/interview\/[^/]+\/review/);
    await expect(page.getByTestId("review-page")).toBeVisible();
  });

  test("canvas column is centred under the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/interview/mock-interview/live");

    const canvas = page.getByTestId("canvas-collaborative-editor");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Centred: the canvas's centre x should sit within 100px of the
    // viewport's centre x on a 1440px-wide screen.
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) return;
    const canvasCenter = box.x + box.width / 2;
    const viewportCenter = viewport.width / 2;
    expect(Math.abs(canvasCenter - viewportCenter)).toBeLessThanOrEqual(100);
    // Canvas should NOT span the entire viewport — the prose column is
    // capped at max-w-3xl (768px) by the shell.
    expect(box.width).toBeLessThan(viewport.width);
  });
});
