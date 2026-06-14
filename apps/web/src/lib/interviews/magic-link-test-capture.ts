import "server-only";

/**
 * Test-only in-memory store for capturing the most recently issued magic-link
 * URL per guest email address. Enabled when the
 * `INTERVIEW_MAGIC_LINK_TEST_CAPTURE` env var is set to "true" — see
 * `sendMagicLinkEmail` and the `_test/magic-link-capture` route. Allows the
 * Playwright e2e suite to follow the magic-link without an outbound email
 * service. Never enabled in production.
 */

interface CapturedMagicLink {
  url: string;
  capturedAt: number;
}

const capturedByEmail = new Map<string, CapturedMagicLink>();

export function isMagicLinkTestCaptureEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.INTERVIEW_MAGIC_LINK_TEST_CAPTURE === "true"
  );
}

export function recordMagicLinkUrl(email: string, url: string): void {
  capturedByEmail.set(email.toLowerCase(), {
    url,
    capturedAt: Date.now(),
  });
}

export function getLatestMagicLinkUrlFor(email: string): CapturedMagicLink | null {
  return capturedByEmail.get(email.toLowerCase()) ?? null;
}

export function clearMagicLinkCaptures(): void {
  capturedByEmail.clear();
}
