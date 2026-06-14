import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateMcpToken } from "./auth";

const mockFindApiKeyByToken = vi.hoisted(() => vi.fn());
const mockTouchApiKeyLastUsed = vi.hoisted(() => vi.fn());
const mockGetMembershipForBlog = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-keys/repository", () => ({
  findApiKeyByToken: mockFindApiKeyByToken,
  touchApiKeyLastUsed: mockTouchApiKeyLastUsed,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  getMembershipForBlog: mockGetMembershipForBlog,
}));

// A token long enough to pass the length guard (>= 10 chars).
const VALID_TOKEN = `sk-${"a".repeat(64)}`;

describe("validateMcpToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTouchApiKeyLastUsed.mockResolvedValue(1);
    // Default: owner has an active membership on the key's blog.
    mockGetMembershipForBlog.mockResolvedValue({
      blogId: "blog-B",
      role: "admin",
    });
  });

  it("returns the resolved auth context (apiKeyId, ownerId, blogId)", async () => {
    mockFindApiKeyByToken.mockResolvedValue({
      id: "key-123",
      ownerId: "user-1",
      blogId: "blog-B",
      scopes: ["read", "write"],
    });

    const auth = await validateMcpToken(`Bearer ${VALID_TOKEN}`);

    expect(auth).toEqual({
      apiKeyId: "key-123",
      ownerId: "user-1",
      blogId: "blog-B",
    });
    // The bare token (not the header) is what gets looked up.
    expect(mockFindApiKeyByToken).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it("verifies the owner's membership on the key's blog (defense-in-depth)", async () => {
    mockFindApiKeyByToken.mockResolvedValue({
      id: "key-123",
      ownerId: "user-1",
      blogId: "blog-B",
      scopes: [],
    });

    await validateMcpToken(`Bearer ${VALID_TOKEN}`);

    expect(mockGetMembershipForBlog).toHaveBeenCalledWith("user-1", "blog-B");
  });

  it("rejects (null) when the owner no longer has membership on the key's blog", async () => {
    mockFindApiKeyByToken.mockResolvedValue({
      id: "key-123",
      ownerId: "user-1",
      blogId: "blog-B",
      scopes: [],
    });
    mockGetMembershipForBlog.mockResolvedValue(null);

    const auth = await validateMcpToken(`Bearer ${VALID_TOKEN}`);

    expect(auth).toBeNull();
    // No telemetry write for a rejected key.
    expect(mockTouchApiKeyLastUsed).not.toHaveBeenCalled();
  });

  it("fire-and-forget touches lastUsed on success", async () => {
    mockFindApiKeyByToken.mockResolvedValue({
      id: "key-123",
      ownerId: "user-1",
      blogId: "blog-B",
      scopes: [],
    });

    await validateMcpToken(`Bearer ${VALID_TOKEN}`);

    expect(mockTouchApiKeyLastUsed).toHaveBeenCalledWith("key-123");
  });

  it("returns null for an unknown token (→ route 401)", async () => {
    mockFindApiKeyByToken.mockResolvedValue(null);

    const auth = await validateMcpToken(`Bearer ${VALID_TOKEN}`);

    expect(auth).toBeNull();
    expect(mockTouchApiKeyLastUsed).not.toHaveBeenCalled();
  });

  it("returns null when the Authorization header is missing", async () => {
    const auth = await validateMcpToken(null);

    expect(auth).toBeNull();
    expect(mockFindApiKeyByToken).not.toHaveBeenCalled();
  });

  it("returns null when the Authorization header lacks the Bearer scheme", async () => {
    const auth = await validateMcpToken(VALID_TOKEN);

    expect(auth).toBeNull();
    expect(mockFindApiKeyByToken).not.toHaveBeenCalled();
  });

  it("short-circuits a token below the length guard without a lookup", async () => {
    const auth = await validateMcpToken("Bearer short");

    expect(auth).toBeNull();
    expect(mockFindApiKeyByToken).not.toHaveBeenCalled();
  });

  it("never 500s — a lookup that throws is caught and returns null", async () => {
    mockFindApiKeyByToken.mockRejectedValue(new Error("D1 unavailable"));

    const auth = await validateMcpToken(`Bearer ${VALID_TOKEN}`);

    expect(auth).toBeNull();
  });

  it("a failing lastUsed touch does not break auth (still returns the context)", async () => {
    mockFindApiKeyByToken.mockResolvedValue({
      id: "key-123",
      ownerId: "user-1",
      blogId: "blog-B",
      scopes: [],
    });
    mockTouchApiKeyLastUsed.mockRejectedValue(new Error("write failed"));

    const auth = await validateMcpToken(`Bearer ${VALID_TOKEN}`);

    expect(auth?.apiKeyId).toBe("key-123");
  });
});
