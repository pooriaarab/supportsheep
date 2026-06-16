import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyRequest = vi.fn();
const mockLogAuditEvent = vi.fn();
const mockListBlogsForUser = vi.fn();

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

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock("@/lib/tenancy/blogs", () => ({
  listBlogsForUser: mockListBlogsForUser,
}));

function postRequest(body: unknown): Request {
  return new Request("http://test.local/api/v1/blogs/active", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/blogs/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({
      uid: "user-1",
      email: "u@x.test",
      authTime: 0,
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("sets the bb_active_blog cookie when the caller is a member", async () => {
    mockListBlogsForUser.mockResolvedValue([
      { id: "blog-1", slug: "a", displayName: "A", role: "owner" },
      { id: "blog-2", slug: "b", displayName: "B", role: "editor" },
    ]);

    const route = await import("./route");
    const res = await route.POST(postRequest({ blogId: "blog-2" }) as never);

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("bb_active_blog=blog-2");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("path=/");
  });

  it("rejects with 403 and sets no cookie when the caller is not a member", async () => {
    mockListBlogsForUser.mockResolvedValue([
      { id: "blog-1", slug: "a", displayName: "A", role: "owner" },
    ]);

    const route = await import("./route");
    const res = await route.POST(postRequest({ blogId: "blog-999" }) as never);

    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
