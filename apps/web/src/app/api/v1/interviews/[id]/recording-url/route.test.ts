import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyInterviewToken = vi.hoisted(() => vi.fn());
const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());

// Auth & verifyRequest
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
  // Guest cookie name used by resolveInterviewTokenFromRequest.
  getInterviewTokenCookieName: (id: string) => `interview_token_${id}`,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

// D1 repositories (replace the legacy Firestore reads).
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

// Tenancy — workspace role is resolved from blog_members via getMembershipByUser.
const mockGetMembershipByUser = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
  resolveTenantForUser: vi.fn(async () => ({ blogId: "default", role: "owner" })),
  getMembershipByUser: mockGetMembershipByUser,
}));

import { GET } from "./route";

const makeReq = (search: string, headers: Record<string, string> = {}) =>
  new NextRequest(
    `http://localhost/api/v1/interviews/int-1/recording-url${search}`,
    { method: "GET", headers },
  );

describe("GET /api/v1/interviews/[id]/recording-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("returns 401 with no auth header and no session", async () => {
    mockVerifyRequest.mockRejectedValue(new Error("nope"));

    const res = await GET(
      makeReq("?kind=question&questionId=q1"),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("returns 401 with an invalid interview token", async () => {
    mockVerifyInterviewToken.mockReturnValue(null);

    const res = await GET(
      makeReq("?kind=question&questionId=q1", {
        Authorization: "Bearer invalid",
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(401);
  });

  it("returns 401 when the bearer token is for a different interview", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "OTHER",
      iat: 0,
      exp: Date.now() / 1000 + 1000,
    });

    const res = await GET(
      makeReq("?kind=question&questionId=q1", {
        Authorization: "Bearer x",
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid kind", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-1",
      iat: 0,
      exp: Date.now() / 1000 + 1000,
    });

    const res = await GET(
      makeReq("?kind=bogus&questionId=q1", { Authorization: "Bearer x" }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid questionId", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-1",
      iat: 0,
      exp: Date.now() / 1000 + 1000,
    });

    const res = await GET(
      makeReq("?kind=question&questionId=", { Authorization: "Bearer x" }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(400);
  });

  it("returns a streaming URL for a guest playing back a question", async () => {
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

    const res = await GET(
      makeReq("?kind=question&questionId=q1", { Authorization: "Bearer x" }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    // Same-origin streaming path — the client <audio> loads it directly.
    expect(json.url).toBe(
      "/api/v1/interviews/int-1/recording-file?kind=question&questionId=q1",
    );
  });

  it("forbids guests from fetching response audio", async () => {
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
    expect(mockGetAsyncResponse).not.toHaveBeenCalled();
  });

  it("allows workspace admin/editor/owner to fetch response audio", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-1" });
    mockGetMembershipByUser.mockResolvedValue({
      blogId: "default",
      role: "admin",
    } as never);
    mockGetInterview.mockResolvedValue({ id: "int-1", shareLinkId: "sl-1" });
    mockGetAsyncResponse.mockResolvedValue({
      questionId: "q1",
      audioStoragePath: "interviews/int-1/responses/q1.webm",
    });

    const res = await GET(
      makeReq("?kind=response&questionId=q1"),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe(
      "/api/v1/interviews/int-1/recording-file?kind=response&questionId=q1",
    );
  });

  it("forbids workspace viewer role from fetching response audio", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-2" });
    mockGetMembershipByUser.mockResolvedValue({
      blogId: "default",
      role: "viewer",
    } as never);

    const res = await GET(
      makeReq("?kind=response&questionId=q1"),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(403);
    expect(mockGetAsyncResponse).not.toHaveBeenCalled();
  });

  it("forbids workspace guest role from fetching response audio", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-3" });
    mockGetMembershipByUser.mockResolvedValue(null as never);

    const res = await GET(
      makeReq("?kind=response&questionId=q1"),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 when the interview does not exist", async () => {
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

  it("returns 404 when the question id is not on the share link", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-1",
      iat: 0,
      exp: Date.now() / 1000 + 1000,
    });
    mockGetInterview.mockResolvedValue({ id: "int-1", shareLinkId: "sl-1" });
    mockGetShareLink.mockResolvedValue({ id: "sl-1", asyncQuestions: [] });

    const res = await GET(
      makeReq("?kind=question&questionId=q-missing", {
        Authorization: "Bearer x",
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );

    expect(res.status).toBe(404);
  });
});
