/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import AuthorLivePage from "../page";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: mockVerifyRequest,
}));

const mockGetInterview = vi.hoisted(() => vi.fn());
const mockConsentToLive = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ok: true }),
);

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
  consentToLive: mockConsentToLive,
}));

const mockGetBlogConfig = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ interview: { monthlyCostCapUsd: null } }),
);
vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mockGetBlogConfig,
}));

const mockGetMembershipByUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tenancy/repository", () => ({
  getMembershipByUser: mockGetMembershipByUser,
  DEFAULT_BLOG_ID: "default",
}));

const mockGetBlogMember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tenancy/members", () => ({
  getBlogMember: mockGetBlogMember,
}));

const mockMintRealtimeSession = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    client_secret: { value: "mock-openai-token", expires_at: 123456 },
    id: "mock-session-id",
  }),
);
vi.mock("@/lib/interviews/openai-realtime", () => ({
  mintRealtimeSession: mockMintRealtimeSession,
  CANVAS_TOOLS: [],
}));

vi.mock("@/lib/interviews/interview-token", () => ({
  mintInterviewToken: () => "mock-interview-hmac-token",
  buildInterviewTokenCookie: (interviewId: string, token: string) => ({
    name: `interview_token_${interviewId}`,
    value: token,
    options: {
      httpOnly: true,
      secure: false,
      sameSite: "lax" as const,
      path: `/api/v1/interviews/${interviewId}`,
      maxAge: 1800,
    },
  }),
}));

const mockCookieSet = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: mockCookieSet }),
}));

vi.mock("@/components/interview/in-call-layout-desktop", () => ({
  InCallLayoutDesktop: (props: any) => (
    <div data-testid="in-call-layout">
      <h1>Topic: {props.topic}</h1>
      <h2>Speaker: {props.guestName}</h2>
      <h3>Token: {props.ephemeralOpenAiToken}</h3>
    </div>
  ),
}));

describe("AuthorLivePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login if user is unauthenticated", async () => {
    mockVerifyRequest.mockRejectedValue(new Error("Unauthorized"));
    // Since Next.js redirect throws, we can assert it throws
    await expect(
      AuthorLivePage({ params: Promise.resolve({ id: "interview-123" }) })
    ).rejects.toThrow();
  });

  it("renders ExpiredCard if interview does not exist", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-123", email: "user@example.com" });
    mockGetInterview.mockResolvedValue(null);

    const result = await AuthorLivePage({ params: Promise.resolve({ id: "interview-123" }) });
    const html = renderToStaticMarkup(result);

    expect(html).toContain("Interview not found or inactive");
  });

  it("renders ExpiredCard if current user is not the interview creator", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-different", email: "user@example.com" });
    mockGetInterview.mockResolvedValue({
      status: "consent",
      startedByUid: "user-123",
      style: "smart",
      topic: "Some Topic",
    });
    // Viewer is a plain "guest" — no workspace admin shortcut, no share link.
    // Expect access resolver to return null and the ExpiredCard to render.
    mockGetMembershipByUser.mockResolvedValue(null);

    const result = await AuthorLivePage({ params: Promise.resolve({ id: "interview-123" }) });
    const html = renderToStaticMarkup(result);

    expect(html).toContain("Interview not found or inactive");
  });

  it("transitions status from consent to live and renders InCallLayoutDesktop", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-123", email: "user@example.com" });
    mockGetInterview.mockResolvedValue({
      status: "consent",
      startedByUid: "user-123",
      style: "smart",
      topic: "Artificial Intelligence in Medicine",
      maxDurationSec: 600,
    });
    mockGetMembershipByUser.mockResolvedValue({ blogId: "default", role: "owner" });
    mockGetBlogMember.mockResolvedValue({ id: "user-123", name: "Dr. Alice" });
    mockConsentToLive.mockResolvedValue({ ok: true });

    const result = await AuthorLivePage({ params: Promise.resolve({ id: "interview-123" }) });
    const html = renderToStaticMarkup(result);

    expect(mockConsentToLive).toHaveBeenCalled();
    expect(html).toContain("Artificial Intelligence in Medicine");
    expect(html).toContain("Dr. Alice");
    expect(html).toContain("mock-openai-token");
  });

  it("sets the interview-token cookie BEFORE awaiting mintRealtimeSession (regression for w26 500)", async () => {
    // Next.js App Router throws if `cookies().set(...)` is called from a
    // Server Component after the response has begun streaming. In practice
    // this means the cookie write must happen BEFORE any long-running
    // upstream `await` like the OpenAI realtime session mint. This test
    // pins the call order so we don't regress to the prod 500.
    const callOrder: string[] = [];

    mockCookieSet.mockImplementation(() => {
      callOrder.push("cookies.set");
    });
    mockMintRealtimeSession.mockImplementation(async () => {
      callOrder.push("mintRealtimeSession");
      return {
        client_secret: { value: "mock-openai-token", expires_at: 123456 },
        id: "mock-session-id",
      };
    });

    mockVerifyRequest.mockResolvedValue({ uid: "user-123", email: "user@example.com" });
    mockGetInterview.mockResolvedValue({
      status: "live", // skip the transition branch
      startedByUid: "user-123",
      style: "smart",
      topic: "Order-of-Operations Topic",
      maxDurationSec: 300,
    });
    mockGetMembershipByUser.mockResolvedValue({ blogId: "default", role: "owner" });
    mockGetBlogMember.mockResolvedValue({ id: "user-123", name: "Author" });

    await AuthorLivePage({ params: Promise.resolve({ id: "interview-order-1" }) });

    expect(mockCookieSet).toHaveBeenCalledTimes(1);
    expect(mockMintRealtimeSession).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["cookies.set", "mintRealtimeSession"]);

    // And the cookie payload is well-formed
    const setArg = mockCookieSet.mock.calls[0][0];
    expect(setArg).toMatchObject({
      name: "interview_token_interview-order-1",
      value: "mock-interview-hmac-token",
      httpOnly: true,
      sameSite: "lax",
      path: "/api/v1/interviews/interview-order-1",
    });
  });
});
