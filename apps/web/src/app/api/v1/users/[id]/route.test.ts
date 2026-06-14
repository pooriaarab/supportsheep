import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as route from "@/app/api/v1/users/[id]/route";

const getBlogMember = vi.hoisted(() => vi.fn());
const updateMemberRole = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenancy/members", () => ({
  getBlogMember,
  updateMemberRole,
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
  DEFAULT_BLOG_ID: "default",
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

const idParam = { params: Promise.resolve({ id: "u1" }) } as never;

describe("GET /api/v1/users/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the member (AppUser shape)", async () => {
    getBlogMember.mockResolvedValue(member);
    const response = await route.GET(
      new NextRequest("https://supportsheep.com/api/v1/users/u1"),
      idParam,
    );

    expect(response.status).toBe(200);
    expect(getBlogMember).toHaveBeenCalledWith("default", "u1");
    expect(await response.json()).toEqual(member);
  });

  it("returns 404 when the user is not a member", async () => {
    getBlogMember.mockResolvedValue(null);
    const response = await route.GET(
      new NextRequest("https://supportsheep.com/api/v1/users/u1"),
      idParam,
    );
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/users/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps role 'user' to 'viewer' and updates", async () => {
    updateMemberRole.mockResolvedValue({ ok: true, member });
    const response = await route.PATCH(
      new NextRequest("https://supportsheep.com/api/v1/users/u1", {
        method: "PATCH",
        body: JSON.stringify({ role: "user" }),
      }),
      idParam,
    );

    expect(response.status).toBe(200);
    expect(updateMemberRole).toHaveBeenCalledWith("default", "u1", "viewer");
    expect(await response.json()).toEqual(member);
  });

  it("maps role 'admin' to 'admin'", async () => {
    updateMemberRole.mockResolvedValue({ ok: true, member });
    await route.PATCH(
      new NextRequest("https://supportsheep.com/api/v1/users/u1", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      }),
      idParam,
    );
    expect(updateMemberRole).toHaveBeenCalledWith("default", "u1", "admin");
  });

  it("returns 404 when the member is not found", async () => {
    updateMemberRole.mockResolvedValue({ ok: false, reason: "not_found" });
    const response = await route.PATCH(
      new NextRequest("https://supportsheep.com/api/v1/users/u1", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      }),
      idParam,
    );
    expect(response.status).toBe(404);
  });

  it("returns 409 cannot_demote_last_owner", async () => {
    updateMemberRole.mockResolvedValue({ ok: false, reason: "last_owner" });
    const response = await route.PATCH(
      new NextRequest("https://supportsheep.com/api/v1/users/u1", {
        method: "PATCH",
        body: JSON.stringify({ role: "viewer" }),
      }),
      idParam,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "cannot_demote_last_owner" });
  });

  it("returns the current member unchanged when only name/status is sent (no role)", async () => {
    getBlogMember.mockResolvedValue(member);
    const response = await route.PATCH(
      new NextRequest("https://supportsheep.com/api/v1/users/u1", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      }),
      idParam,
    );

    expect(response.status).toBe(200);
    expect(updateMemberRole).not.toHaveBeenCalled();
    expect(getBlogMember).toHaveBeenCalledWith("default", "u1");
    expect(await response.json()).toEqual(member);
  });
});
