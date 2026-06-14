import { describe, it, expect, vi } from "vitest";

// Mock next/headers so importing session.ts (which imports cookies/headers)
// doesn't require a Next.js request context in the test runner.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], get: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

import { verifySession } from "./session";

describe("verifySession", () => {
  it("always returns null — legacy Firebase session cookies are no longer verifiable", async () => {
    // The Firebase Admin SDK (the only thing that could validate a legacy
    // session-cookie signature) has been removed in the Cloudflare migration.
    // Better Auth is now the authoritative session backend, so this shim
    // degrades every legacy cookie to "unauthenticated".
    await expect(verifySession("any-cookie")).resolves.toBeNull();
    await expect(verifySession("")).resolves.toBeNull();
  });
});
