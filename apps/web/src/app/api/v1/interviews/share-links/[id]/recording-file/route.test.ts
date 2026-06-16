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

import { AuthError as MockAuthError } from "@/lib/auth/session";

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

const tenantState = vi.hoisted(() => ({ role: "owner" }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(async () => null),
}));

const mockGetShareLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: mockGetShareLink,
}));

const mockBucketGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: () => ({ get: mockBucketGet }),
}));

import { GET } from "./route";

const makeReq = (search: string) =>
  new NextRequest(
    `http://localhost/api/v1/interviews/share-links/sl-1/recording-file${search}`,
    { method: "GET" },
  );

const makeR2Object = () => ({
  body: new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  }),
  httpMetadata: { contentType: "audio/webm" },
});

describe("GET /api/v1/interviews/share-links/[id]/recording-file", () => {
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
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("rejects users without minter role (403)", async () => {
    tenantState.role = "viewer";

    const res = await GET(
      makeReq("?questionId=q1"),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(403);
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("streams question audio for a minter", async () => {
    tenantState.role = "admin";
    mockGetShareLink.mockResolvedValue({
      id: "sl-1",
      asyncQuestions: [
        { id: "q1", audioStoragePath: "share-links/sl-1/questions/q1.webm" },
      ],
    });
    mockBucketGet.mockResolvedValue(makeR2Object());

    const res = await GET(
      makeReq("?questionId=q1"),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/webm");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(mockBucketGet).toHaveBeenCalledWith(
      "share-links/sl-1/questions/q1.webm",
    );
  });

  it("returns 404 when the question is not on the share link", async () => {
    tenantState.role = "editor";
    mockGetShareLink.mockResolvedValue({ id: "sl-1", asyncQuestions: [] });

    const res = await GET(
      makeReq("?questionId=q-missing"),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when the object is missing from R2", async () => {
    tenantState.role = "admin";
    mockGetShareLink.mockResolvedValue({
      id: "sl-1",
      asyncQuestions: [
        { id: "q1", audioStoragePath: "share-links/sl-1/questions/q1.webm" },
      ],
    });
    mockBucketGet.mockResolvedValue(null);

    const res = await GET(
      makeReq("?questionId=q1"),
      { params: Promise.resolve({ id: "sl-1" }) } as never,
    );

    expect(res.status).toBe(404);
  });
});
