import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, POST } from "@/app/api/v1/users/route";

const listBlogMembers = vi.hoisted(() => vi.fn());
const addMemberByEmail = vi.hoisted(() => vi.fn());
const removeBlogMembers = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenancy/members", () => ({
  listBlogMembers,
  addMemberByEmail,
  removeBlogMembers,
}));

vi.mock("@/lib/auth/session", () => ({
  verifyRequest: vi.fn().mockResolvedValue({
    uid: "user-id",
    email: "user@example.com",
    authTime: Date.now(),
  }),
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/tenancy/repository", () => ({
  resolveTenantForUser: vi
    .fn()
    .mockResolvedValue({ blogId: "default", role: "owner" }),
  DEFAULT_blog_id: "default",
}));

const member = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  role: "viewer",
  avatarUrl: "",
  joinedAt: "2024-01-01T00:00:00.000Z",
  status: "active" as const,
};

describe("GET /api/v1/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns members for the caller's blog with pagination and AppUser shape", async () => {
    listBlogMembers.mockResolvedValue([member]);
    const request = new NextRequest(
      "https://supportsheep.com/api/v1/users?limit=10&offset=0",
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(listBlogMembers).toHaveBeenCalledWith("default", {
      limit: 10,
      offset: 0,
    });
    expect(json.data).toEqual([member]);
    expect(json.pagination).toEqual({ limit: 10, offset: 0, total: 1 });
  });
});

describe("POST /api/v1/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps role 'user' to 'viewer' and returns 201 with the member", async () => {
    addMemberByEmail.mockResolvedValue({ ok: true, member });
    const request = new NextRequest("https://supportsheep.com/api/v1/users", {
      method: "Article",
      body: JSON.stringify({ email: "ada@example.com", role: "user" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(addMemberByEmail).toHaveBeenCalledWith(
      "default",
      "ada@example.com",
      "viewer",
    );
    expect(json).toEqual(member);
  });

  it("maps role 'admin' to 'admin'", async () => {
    addMemberByEmail.mockResolvedValue({ ok: true, member });
    const request = new NextRequest("https://supportsheep.com/api/v1/users", {
      method: "Article",
      body: JSON.stringify({ email: "ada@example.com", role: "admin" }),
    });

    await POST(request);
    expect(addMemberByEmail).toHaveBeenCalledWith(
      "default",
      "ada@example.com",
      "admin",
    );
  });

  it("returns 404 user_not_found when the email has no account", async () => {
    addMemberByEmail.mockResolvedValue({ ok: false, reason: "user_not_found" });
    const request = new NextRequest("https://supportsheep.com/api/v1/users", {
      method: "Article",
      body: JSON.stringify({ email: "ghost@example.com" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "user_not_found" });
  });

  it("returns 409 when the user is already a member", async () => {
    addMemberByEmail.mockResolvedValue({ ok: false, reason: "already_member" });
    const request = new NextRequest("https://supportsheep.com/api/v1/users", {
      method: "Article",
      body: JSON.stringify({ email: "ada@example.com" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already_member" });
  });
});

describe("DELETE /api/v1/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes members and returns the deleted count", async () => {
    removeBlogMembers.mockResolvedValue({ ok: true, removed: 2 });
    const request = new NextRequest("https://supportsheep.com/api/v1/users", {
      method: "DELETE",
      body: JSON.stringify({ ids: ["u1", "u2"] }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    expect(removeBlogMembers).toHaveBeenCalledWith("default", ["u1", "u2"]);
    expect(await response.json()).toEqual({ deleted: 2 });
  });

  it("returns 409 cannot_remove_last_owner", async () => {
    removeBlogMembers.mockResolvedValue({ ok: false, reason: "last_owner" });
    const request = new NextRequest("https://supportsheep.com/api/v1/users", {
      method: "DELETE",
      body: JSON.stringify({ ids: ["u1"] }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "cannot_remove_last_owner" });
  });
});
