import { vi } from "vitest";

// Route/unit tests exercise createApiHandler, which resolves the tenant via
// resolveTenantForUser() → getDb(). Tests don't have a D1 binding, so mock the
// tenancy repo to a default owner tenant. The real implementation is unit-tested
// directly in src/lib/tenancy/repository.test.ts (which unmocks this).
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  // Real class so `error instanceof NeedsOnboardingError` checks (and any
  // import of the symbol) work under the mock.
  NeedsOnboardingError: class NeedsOnboardingError extends Error {
    constructor() {
      super("needs_onboarding");
      this.name = "NeedsOnboardingError";
    }
  },
  resolveTenantForUser: vi.fn(async () => ({ blogId: "default", role: "owner" })),
  // Default to an existing membership so the dashboard guard (and other code
  // paths) don't redirect to onboarding in unrelated tests. Tests that need the
  // no-membership case override this with mockResolvedValueOnce(null).
  getMembershipByUser: vi.fn(async () => ({ blogId: "default", role: "owner" })),
}));
