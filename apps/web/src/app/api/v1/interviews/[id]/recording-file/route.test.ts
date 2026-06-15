import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyInterviewToken = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/interviews/interview-token", () => ({
  verifyInterviewToken: mockVerifyInterviewToken,
  getInterviewTokenCookieName: (id: string) => `interview_token_${id}`,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

const mockGetInterview = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
}));

const mockGetShareLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: mockGetShareLink,
}));

const mockGetAsyncResponse = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/async-responses-repository", () => ({
  getAsyncResponse: mockGetAsyncResponse,
}));

const mockGetMembershipByUser = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({ blogId: "default", role: "owner" })),
  getMembershipByUser: mockGetMembershipByUser,
}));

// R2 bucket — returns a streamable object.
const mockBucketGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: () => ({ get: mockBucketGet }),
}));

import { GET } from "./route";

const makeReq = (search: string, headers: Record<string, string> = {}) =>
  new NextRequest(
    `http://localhost/api/v1/interviews/int-1/recording-file${search}`,
    { method: "GET", headers },
  );

const makeR2Object = (contentType?: string) => ({
  body: new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  }),
  httpMetadata: contentType ? { contentType } : undefined,
});

describe("GET /api/v1/interviews/[id]/recording-file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("streams question audio for a guest with a valid interview token", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-1",
      iat: 0,
      exp: Date.now() / 1000 + 1000,
    });
    mockGetInterview.mockResolvedValue({ id: "int-1", shareLinkId: "sl-1" });
    mockGetShareLink.mockResolvedValue({
      id: "sl-1",
      asyncQuestions: [
        { id: "q1", audioStoragePath: "share-links/sl-1/questions/q1.webm" },
      ],
    });
    mockBucketGet.mockResolvedValue(makeR2Object("audio/webm"));

    const res = await GET(
      makeReq("?kind=question&questionId=q1", { Authorization: "Bearer x" }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/webm");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(mockBucketGet).toHaveBeenCalledWith(
      "share-links/sl-1/questions/q1.webm",
    );
  });

  it("forbids a guest from fetching response audio (403)", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-1",
      iat: 0,
      exp: Date.now() / 1000 + 1000,
    });

    const res = await GET(
      makeReq("?kind=response&questionId=q1", { Authorization: "Bearer x" }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(403);
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("forbids a workspace viewer from fetching response audio (403)", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-1" });
    mockGetMembershipByUser.mockResolvedValue({
      blogId: "default",
      role: "viewer",
    } as never);

    const res = await GET(
      makeReq("?kind=response&questionId=q1"),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(403);
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("streams response audio for a workspace editor/admin/owner", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-1" });
    mockGetMembershipByUser.mockResolvedValue({
      blogId: "default",
      role: "editor",
    } as never);
    mockGetInterview.mockResolvedValue({ id: "int-1", shareLinkId: "sl-1" });
    mockGetAsyncResponse.mockResolvedValue({
      questionId: "q1",
      audioStoragePath: "interviews/int-1/responses/q1.webm",
    });
    mockBucketGet.mockResolvedValue(makeR2Object());

    const res = await GET(
      makeReq("?kind=response&questionId=q1"),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(200);
    // Defaults to audio/webm when the object has no content-type metadata.
    expect(res.headers.get("content-type")).toBe("audio/webm");
    expect(mockBucketGet).toHaveBeenCalledWith(
      "interviews/int-1/responses/q1.webm",
    );
  });

  it("returns 401 when neither a guest token nor a session is present", async () => {
    mockVerifyRequest.mockRejectedValue(new Error("nope"));

    const res = await GET(
      makeReq("?kind=question&questionId=q1"),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown interview id", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-1",
      iat: 0,
      exp: Date.now() / 1000 + 1000,
    });
    mockGetInterview.mockResolvedValue(null);

    const res = await GET(
      makeReq("?kind=question&questionId=q1", { Authorization: "Bearer x" }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when the object is missing from R2", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-1",
      iat: 0,
      exp: Date.now() / 1000 + 1000,
    });
    mockGetInterview.mockResolvedValue({ id: "int-1", shareLinkId: "sl-1" });
    mockGetShareLink.mockResolvedValue({
      id: "sl-1",
      asyncQuestions: [
        { id: "q1", audioStoragePath: "share-links/sl-1/questions/q1.webm" },
      ],
    });
    mockBucketGet.mockResolvedValue(null);

    const res = await GET(
      makeReq("?kind=question&questionId=q1", { Authorization: "Bearer x" }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(404);
  });
});
