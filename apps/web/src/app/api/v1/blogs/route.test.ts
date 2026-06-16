import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateBlog = vi.fn();
const mockListBlogsForUser = vi.fn();
const mockVerifyRequest = vi.fn();
const mockLogAuditEvent = vi.fn();

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
  createBlog: mockCreateBlog,
  listBlogsForUser: mockListBlogsForUser,
}));

const mockReadActiveBlogHint = vi.fn();
vi.mock("@/lib/tenancy/active-blog", () => ({
  readActiveBlogHint: mockReadActiveBlogHint,
}));

function postRequest(body: unknown): Request {
  return new Request("http://test.local/api/v1/blogs", {
    method: "Article",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("blogs routes", () => {
  beforeEach(() => {
    mockCreateBlog.mockReset();
    mockListBlogsForUser.mockReset();
    mockVerifyRequest.mockReset();
    mockVerifyRequest.mockResolvedValue({
      uid: "user-1",
      email: "owner@example.com",
      authTime: 0,
    });
    mockLogAuditEvent.mockReset();
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockReadActiveBlogHint.mockReset();
    mockReadActiveBlogHint.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // POST
  // -------------------------------------------------------------------------

  it("creates a blog and returns 201 with the owner blog entry", async () => {
    mockCreateBlog.mockResolvedValue({
      ok: true,
      blog: {
        id: "blog-1",
        slug: "my-blog",
        displayName: "My Support Hub",
        role: "owner",
      },
    });

    const route = await import("./route");
    const response = await route.POST(
      postRequest({ slug: "my-blog", displayName: "My Support Hub" }) as never,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "blog-1",
      slug: "my-blog",
      displayName: "My Support Hub",
      role: "owner",
    });
    expect(mockCreateBlog).toHaveBeenCalledWith({
      slug: "my-blog",
      displayName: "My Support Hub",
      ownerUserId: "user-1",
    });
  });

  it("returns 400 invalid_slug for an invalid format", async () => {
    mockCreateBlog.mockResolvedValue({ ok: false, reason: "invalid_format" });

    const route = await import("./route");
    const response = await route.POST(
      postRequest({ slug: "bad slug", displayName: "Bad Format" }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_slug" });
  });

  it("returns 400 slug_reserved for a reserved slug", async () => {
    mockCreateBlog.mockResolvedValue({ ok: false, reason: "reserved" });

    const route = await import("./route");
    const response = await route.POST(
      postRequest({ slug: "admin", displayName: "Admin" }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "slug_reserved" });
  });

  it("returns 409 slug_taken when the slug is already claimed", async () => {
    mockCreateBlog.mockResolvedValue({ ok: false, reason: "slug_taken" });

    const route = await import("./route");
    const response = await route.POST(
      postRequest({ slug: "taken", displayName: "Taken" }) as never,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "slug_taken" });
  });

  // -------------------------------------------------------------------------
  // GET
  // -------------------------------------------------------------------------

  it("lists the caller's blogs with the earliest as active when no cookie hint", async () => {
    mockListBlogsForUser.mockResolvedValue([
      { id: "blog-1", slug: "my-blog", displayName: "My Support Hub", role: "owner" },
      { id: "blog-2", slug: "other", displayName: "Other", role: "editor" },
    ]);
    mockReadActiveBlogHint.mockResolvedValue(null);

    const route = await import("./route");
    const response = await route.GET(
      new Request("http://test.local/api/v1/blogs") as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        { id: "blog-1", slug: "my-blog", displayName: "My Support Hub", role: "owner" },
        { id: "blog-2", slug: "other", displayName: "Other", role: "editor" },
      ],
      activeBlogId: "blog-1",
    });
    expect(mockListBlogsForUser).toHaveBeenCalledWith("user-1");
  });

  it("uses the cookie hint as active when the user is a member of that blog", async () => {
    mockListBlogsForUser.mockResolvedValue([
      { id: "blog-1", slug: "my-blog", displayName: "My Support Hub", role: "owner" },
      { id: "blog-2", slug: "other", displayName: "Other", role: "editor" },
    ]);
    mockReadActiveBlogHint.mockResolvedValue("blog-2");

    const route = await import("./route");
    const response = await route.GET(
      new Request("http://test.local/api/v1/blogs") as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      activeBlogId: "blog-2",
    });
  });

  it("ignores a cookie hint pointing at a blog the user is not a member of", async () => {
    mockListBlogsForUser.mockResolvedValue([
      { id: "blog-1", slug: "my-blog", displayName: "My Support Hub", role: "owner" },
    ]);
    mockReadActiveBlogHint.mockResolvedValue("blog-999");

    const route = await import("./route");
    const response = await route.GET(
      new Request("http://test.local/api/v1/blogs") as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      activeBlogId: "blog-1",
    });
  });
});
