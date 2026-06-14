import { afterEach, describe, expect, it, vi } from "vitest";

// Mock getDb so getBlogConfig uses an in-memory stub instead of a real D1 binding.
const mockSelect = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  getDb: () => ({
    select: mockSelect,
  }),
}));

// blog-config.ts imports "server-only"; stub it out.
vi.mock("server-only", () => ({}));

import { getBlogConfig } from "@/lib/blog-config";

// Build a chainable drizzle-style query stub that resolves to `rows`.
function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

describe("getBlogConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockSelect.mockReset();
  });

  it("does not fall back to INDEXNOW_API_KEY when blog config has no key", async () => {
    vi.stubEnv("INDEXNOW_API_KEY", "env-only-key");
    // Simulate no row in D1
    mockSelect.mockReturnValue(makeSelectChain([]));

    const config = await getBlogConfig();

    expect(config.seo.submissionProtocols?.indexNow).toEqual({
      enabled: false,
      apiKey: "",
    });
  });
});
