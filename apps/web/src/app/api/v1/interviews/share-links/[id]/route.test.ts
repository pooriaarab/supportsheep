import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());

// Mock Auth verify with AuthError
vi.mock("@/lib/auth/session", () => ({
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
  verifyRequest: mockVerifyRequest,
}));

// Mock Audit Log
vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

// Tenancy mock — ctx.role is resolved from blog_members via resolveTenantForUser.
const tenantState = vi.hoisted(() => ({ role: "owner" }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(async () => null),
}));

// D1 share-links repo mocks
const mockGetShareLink = vi.hoisted(() => vi.fn());
const mockUpdateShareLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: mockGetShareLink,
  updateShareLink: mockUpdateShareLink,
}));

function makeLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "link-id",
    blogId: "default",
    type: "link",
    createdBy: "user-creator-123",
    workspaceId: "default",
    topic: null,
    goal: null,
    style: "smart",
    authMode: "anonymous",
    recordingConfig: "transcript",
    maxDurationSec: 300,
    expiresAt: null,
    maxUses: null,
    uses: 0,
    status: "active",
    tokenHash: "hash-abc",
    language: "en",
    scheduledAt: null,
    scheduledGuestEmail: null,
    mode: "live",
    asyncQuestions: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("PATCH /api/v1/interviews/share-links/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantState.role = "owner";
    mockVerifyRequest.mockResolvedValue({
      uid: "user-creator-123",
      email: "creator@example.com",
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("should return 404 if share link does not exist", async () => {
    mockGetShareLink.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/missing", {
      method: "PATCH",
      body: JSON.stringify({ topic: "New Topic" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "missing" }) } as never);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "share link not found" });
  });

  it("should return 403 if the user is neither creator nor admin/owner", async () => {
    mockGetShareLink.mockResolvedValue(makeLink({ createdBy: "someone-else" }));
    tenantState.role = "editor";

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/link-id", {
      method: "PATCH",
      body: JSON.stringify({ topic: "New Topic" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "link-id" }) } as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toEqual({ error: "forbidden" });
  });

  it("should successfully update if the user is the creator", async () => {
    mockGetShareLink.mockResolvedValue(makeLink());
    tenantState.role = "editor";
    mockUpdateShareLink.mockResolvedValue(makeLink({ topic: "Updated Topic" }));

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/link-id", {
      method: "PATCH",
      body: JSON.stringify({ topic: "Updated Topic", style: "testimonial", language: "es" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "link-id" }) } as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });

    expect(mockUpdateShareLink).toHaveBeenCalledTimes(1);
    const [, , patch] = mockUpdateShareLink.mock.calls[0];
    expect(patch.topic).toBe("Updated Topic");
    expect(patch.style).toBe("testimonial");
    expect(patch.language).toBe("es");
  });

  it("should successfully update if the user is an admin (even if not creator)", async () => {
    mockGetShareLink.mockResolvedValue(makeLink({ createdBy: "someone-else" }));
    tenantState.role = "admin";
    mockUpdateShareLink.mockResolvedValue(makeLink({ createdBy: "someone-else", topic: "Admin Overrode" }));

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/link-id", {
      method: "PATCH",
      body: JSON.stringify({ topic: "Admin Overrode" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "link-id" }) } as never);
    expect(res.status).toBe(200);
    expect(mockUpdateShareLink).toHaveBeenCalledTimes(1);
  });

  it("should reject updates if status is not active (e.g. revoked)", async () => {
    mockGetShareLink.mockResolvedValue(makeLink({ status: "revoked" }));
    tenantState.role = "editor";

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/link-id", {
      method: "PATCH",
      body: JSON.stringify({ topic: "New Topic" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "link-id" }) } as never);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json).toEqual({ error: "cannot update non-active share link" });
  });
});

describe("DELETE /api/v1/interviews/share-links/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantState.role = "owner";
    mockVerifyRequest.mockResolvedValue({
      uid: "user-creator-123",
      email: "creator@example.com",
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("should successfully soft-revoke the share link", async () => {
    mockGetShareLink.mockResolvedValue(makeLink());
    tenantState.role = "editor";
    mockUpdateShareLink.mockResolvedValue(makeLink({ status: "revoked" }));

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/link-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "link-id" }) } as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });

    expect(mockUpdateShareLink).toHaveBeenCalledTimes(1);
    const [, , patch] = mockUpdateShareLink.mock.calls[0];
    expect(patch.status).toBe("revoked");
  });

  it("should return 409 when revoking an already-revoked share link", async () => {
    mockGetShareLink.mockResolvedValue(makeLink({ status: "revoked" }));
    tenantState.role = "editor";

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/link-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "link-id" }) } as never);
    expect(res.status).toBe(409);
    expect(mockUpdateShareLink).not.toHaveBeenCalled();
  });

  it("should return 409 when revoking an expired share link", async () => {
    mockGetShareLink.mockResolvedValue(makeLink({ status: "expired" }));
    tenantState.role = "editor";

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/link-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "link-id" }) } as never);
    expect(res.status).toBe(409);
    expect(mockUpdateShareLink).not.toHaveBeenCalled();
  });
});
