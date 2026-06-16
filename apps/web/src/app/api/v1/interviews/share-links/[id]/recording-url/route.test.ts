import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());

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

// Re-import the mocked AuthError so the test can throw the same constructor
// the handler will instanceof-check.
import { AuthError as MockAuthError } from "@/lib/auth/session";

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

// D1 share-links repo mock
const mockGetShareLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: mockGetShareLink,
}));

import { GET } from "./route";

const makeReq = (search: string) =>
  new NextRequest(
    `http://localhost/api/v1/interviews/share-links/sl-1/recording-url${search}`,
    { method: "GET" },
  );

describe("GET /api/v1/interviews/share-links/[id]/recording-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantState.role = "owner";
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockVerifyRequest.mockResolvedValue({ uid: "user-1" });
  });

  it("requires authentication", async () => {
    mockVerifyRequest.mockRejectedValue(new MockAuthError("unauthorized", 401));

    const res = await GET(
      makeReq("?questionId=q1"),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(401);
    expect(mockGetShareLink).not.toHaveBeenCalled();
  });

  it("rejects users without minter role", async () => {
    tenantState.role = "guest";

    const res = await GET(
      makeReq("?questionId=q1"),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(403);
  });

  it("returns a streaming URL for valid admin request", async () => {
    tenantState.role = "admin";
    mockGetShareLink.mockResolvedValue({
      id: "sl-1",
      blogId: "default",
      asyncQuestions: [
        { id: "q1", audioStoragePath: "share-links/sl-1/questions/q1.webm" },
      ],
    });

    const res = await GET(
      makeReq("?questionId=q1"),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe(
      "/api/v1/interviews/share-links/sl-1/recording-file?questionId=q1",
    );
  });

  it("returns 400 on invalid questionId", async () => {
    tenantState.role = "admin";

    const res = await GET(
      makeReq("?questionId="),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when the question does not exist on the share link", async () => {
    tenantState.role = "editor";
    mockGetShareLink.mockResolvedValue({
      id: "sl-1",
      blogId: "default",
      asyncQuestions: [],
    });

    const res = await GET(
      makeReq("?questionId=q-missing"),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(404);
  });
});
