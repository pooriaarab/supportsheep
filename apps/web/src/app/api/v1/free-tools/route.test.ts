import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListFreeTools = vi.fn();
const mockSeedDefaultFreeTools = vi.fn();
const mockVerifyRequest = vi.fn();
const mockVerifyAuthenticatedRequest = vi.fn();
const mockLogAuditEvent = vi.fn();
class MockDuplicateFreeToolSlugError extends Error {
  constructor(slug: string) {
    super(`Free tool slug already exists: ${slug}`);
    this.name = "DuplicateFreeToolSlugError";
  }
}
const repositoryMocks = ((globalThis as typeof globalThis & {
  __freeToolsRepositoryMocks?: {
    listFreeTools: typeof mockListFreeTools;
    seedDefaultFreeTools: typeof mockSeedDefaultFreeTools;
    patchFreeTool: ReturnType<typeof vi.fn>;
    resolvePublicFreeToolBySlug: ReturnType<typeof vi.fn>;
    DuplicateFreeToolSlugError: typeof MockDuplicateFreeToolSlugError;
  };
}).__freeToolsRepositoryMocks ??= {
  listFreeTools: mockListFreeTools,
  seedDefaultFreeTools: mockSeedDefaultFreeTools,
  patchFreeTool: vi.fn(),
  resolvePublicFreeToolBySlug: vi.fn(),
  DuplicateFreeToolSlugError: MockDuplicateFreeToolSlugError,
});

vi.mock("@/lib/auth/session", () => ({
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public status = 401,
    ) {
      super(message);
      this.name = "AuthError";
    }
  },
  verifyRequest: mockVerifyRequest,
}));

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>(
    "@/lib/api-utils",
  );
  return {
    ...actual,
    verifyAuthenticatedRequest: mockVerifyAuthenticatedRequest,
  };
});

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock("@/lib/free-tools/repository", () => ({
  DuplicateFreeToolSlugError: repositoryMocks.DuplicateFreeToolSlugError,
  listFreeTools: repositoryMocks.listFreeTools,
  patchFreeTool: repositoryMocks.patchFreeTool,
  resolvePublicFreeToolBySlug: repositoryMocks.resolvePublicFreeToolBySlug,
  seedDefaultFreeTools: repositoryMocks.seedDefaultFreeTools,
}));

describe("free tools admin routes", () => {
  beforeEach(() => {
    repositoryMocks.listFreeTools.mockReset();
    repositoryMocks.seedDefaultFreeTools.mockReset();
    mockVerifyRequest.mockResolvedValue({
      uid: "user-1",
      email: "admin@example.com",
      authTime: 0,
    });
    mockVerifyAuthenticatedRequest.mockResolvedValue({
      uid: "user-1",
      email: "admin@example.com",
      authTime: 0,
      role: "admin",
    });
    mockLogAuditEvent.mockReset();
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("lists tools for authenticated admin UI calls", async () => {
    repositoryMocks.listFreeTools.mockResolvedValue([
      { id: "word-counter", title: "Word Counter" },
    ]);

    const route = await import("./route");
    const response = await route.GET(
      new Request("http://test.local/api/v1/free-tools") as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "word-counter", title: "Word Counter" }],
    });
    expect(repositoryMocks.listFreeTools).toHaveBeenCalledOnce();
  });

  it("seeds the full predefined catalog enabled with AI enabled", async () => {
    repositoryMocks.seedDefaultFreeTools.mockResolvedValue({
      created: 60,
      skipped: 4,
    });

    const route = await import("./seed/route");
    const response = await route.POST(
      new Request("http://test.local/api/v1/free-tools/seed", {
        method: "Article",
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { created: 60, skipped: 4 },
    });
    expect(repositoryMocks.seedDefaultFreeTools).toHaveBeenCalledWith(
      { enabled: true, aiEnabled: true },
      expect.any(String), // blogId
    );
  });
});
