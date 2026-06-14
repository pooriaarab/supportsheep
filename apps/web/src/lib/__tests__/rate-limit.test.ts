import { describe, expect, it } from "vitest";

import {
  checkRateLimit,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMITS,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  // No D1 binding is available here (getCloudflareContext is uninitialised), so
  // getDb() throws and the limiter must fail OPEN — never block on a fault.
  it("fails open when the D1 binding is unavailable", async () => {
    const now = 1_000_000;
    const result = await checkRateLimit({
      key: "test-route",
      ip: "1.2.3.4",
      maxPerMinute: 5,
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(5);
    // resetAt is aligned to the end of the current fixed minute window.
    const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    expect(result.resetAt).toBe(windowStart + RATE_LIMIT_WINDOW_MS);
  });

  it("never blocks while failing open, regardless of request volume", async () => {
    const now = 3_000_000;
    for (let i = 0; i < 10; i += 1) {
      const result = await checkRateLimit({
        key: "block",
        ip: "ip",
        maxPerMinute: 4,
        now: now + i,
      });
      expect(result.allowed).toBe(true);
    }
  });

  it("exposes default per-route limits", () => {
    expect(RATE_LIMITS["interview-magic-link"]).toBe(5);
    expect(RATE_LIMITS["interview-consent"]).toBe(10);
    expect(RATE_LIMITS["interview-end"]).toBe(10);
    expect(RATE_LIMITS["interview-events"]).toBe(120);
    expect(RATE_LIMITS["share-link-by-token"]).toBe(60);
  });
});
