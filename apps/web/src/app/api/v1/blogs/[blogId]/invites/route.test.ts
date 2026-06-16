import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyRequest = vi.fn();
const mockLogAuditEvent = vi.fn();
const mockAddMemberByEmail = vi.fn();
const mockCreateInvite = vi.fn();
const mockListPendingInvites = vi.fn();
const mockSendInviteEmail = vi.fn();
const mockGetBlogDisplayName = vi.fn();

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

// resolveTenantForUser resolves the caller's tenant; admin role on "blog-1".
vi.mock("@/lib/tenancy/repository", () => ({
  resolveTenantForUser: vi.fn(async () => ({ blogId: "blog-1", role: "admin" })),
  DEFAULT_blog_id: "default",
  NeedsOnboardingError: class NeedsOnboardingError extends Error {},
}));

vi.mock("@/lib/tenancy/members", () => ({
  addMemberByEmail: mockAddMemberByEmail,
}));

vi.mock("@/lib/tenancy/blogs", () => ({
  getBlogDisplayName: mockGetBlogDisplayName,
}));

vi.mock("@/lib/invites/repository", () => ({
  clampInviteRole: (r: string) =>
    ["author", "editor", "viewer"].includes(r) ? r : "author",
  createInvite: mockCreateInvite,
  listPendingInvites: mockListPendingInvites,
}));

vi.mock("@/lib/invites/send-invite-email", () => ({
  buildAcceptInviteUrl: (t: string) => `https://app.supportsheep.com/accept-invite?token=${t}`,
  sendInviteEmail: mockSendInviteEmail,
}));

function postRequest(body: unknown): Request {
  return new Request("http://test.local/api/v1/blogs/blog-1/invites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = (blogId: string) => ({ params: Promise.resolve({ blogId }) });

describe("POST /api/v1/blogs/{blogId}/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({
      uid: "admin-1",
      email: "admin@supportsheep.com",
      authTime: 0,
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockGetBlogDisplayName.mockResolvedValue("My Support Hub");
    mockSendInviteEmail.mockResolvedValue(undefined);
  });

  it("adds an existing user immediately without sending an email", async () => {
    mockAddMemberByEmail.mockResolvedValue({
      ok: true,
      member: { id: "u9", email: "exists@x.test", role: "editor" },
    });

    const route = await import("./route");
    const res = await route.POST(
      postRequest({ email: "exists@x.test", role: "editor" }) as never,
      params("blog-1") as never,
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ added: true });
    expect(mockAddMemberByEmail).toHaveBeenCalledWith(
      "blog-1",
      "exists@x.test",
      "editor",
    );
    expect(mockCreateInvite).not.toHaveBeenCalled();
    expect(mockSendInviteEmail).not.toHaveBeenCalled();
  });

  it("creates + emails a pending invite when no user exists yet", async () => {
    mockAddMemberByEmail.mockResolvedValue({
      ok: false,
      reason: "user_not_found",
    });
    mockCreateInvite.mockResolvedValue({
      id: "inv-1",
      email: "new@x.test",
      role: "author",
      token: "tok123",
      expiresAt: 123,
      createdAt: 1,
    });

    const route = await import("./route");
    const res = await route.POST(
      postRequest({ email: "new@x.test", role: "author" }) as never,
      params("blog-1") as never,
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ invited: true });
    expect(mockCreateInvite).toHaveBeenCalled();
    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@x.test",
        acceptUrl: "https://app.supportsheep.com/accept-invite?token=tok123",
      }),
    );
  });

  it("returns 409 when the user is already a member", async () => {
    mockAddMemberByEmail.mockResolvedValue({
      ok: false,
      reason: "already_member",
    });

    const route = await import("./route");
    const res = await route.POST(
      postRequest({ email: "exists@x.test", role: "viewer" }) as never,
      params("blog-1") as never,
    );

    expect(res.status).toBe(409);
  });

  it("rejects a path blogId that is not the caller's tenant (403)", async () => {
    const route = await import("./route");
    const res = await route.POST(
      postRequest({ email: "x@x.test", role: "viewer" }) as never,
      params("other-blog") as never,
    );

    expect(res.status).toBe(403);
    expect(mockAddMemberByEmail).not.toHaveBeenCalled();
  });
});
