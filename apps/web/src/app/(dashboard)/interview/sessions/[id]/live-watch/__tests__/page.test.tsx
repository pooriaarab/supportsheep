/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import LiveWatchPage from "../page";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: mockVerifyRequest,
}));

const mockGetInterview = vi.hoisted(() => vi.fn());
const mockGetMembership = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
  getMembershipByUser: mockGetMembership,
}));

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
}));

vi.mock("../live-watch-client", () => ({
  LiveWatchClient: (props: any) => (
    <div data-testid="live-watch-client">
      Topic: {props.interview.topic}
    </div>
  ),
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

describe("LiveWatchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login if user is unauthenticated", async () => {
    mockVerifyRequest.mockRejectedValue(new Error("Unauthorized"));
    await expect(
      LiveWatchPage({ params: Promise.resolve({ id: "interview-123" }) })
    ).rejects.toThrow();
  });

  it("renders access denied if user is not admin/editor/owner", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-123", email: "user@example.com" });
    mockGetMembership.mockResolvedValue({ blogId: "default", role: "viewer" });

    const result = await LiveWatchPage({ params: Promise.resolve({ id: "interview-123" }) });
    const html = renderToStaticMarkup(result);

    expect(html).toContain("Access Denied");
    expect(html).toContain("You do not have administrative permissions");
  });

  it("renders interview not found if interview does not exist", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-123", email: "user@example.com" });
    mockGetMembership.mockResolvedValue({ blogId: "default", role: "admin" });
    mockGetInterview.mockResolvedValue(null);

    const result = await LiveWatchPage({ params: Promise.resolve({ id: "interview-123" }) });
    const html = renderToStaticMarkup(result);

    expect(html).toContain("Interview not found");
    expect(html).toContain("The requested interview session does not exist");
  });

  it("renders Live Watch layout and client component if authorized", async () => {
    mockVerifyRequest.mockResolvedValue({ uid: "user-123", email: "user@example.com" });
    mockGetMembership.mockResolvedValue({ blogId: "default", role: "editor" });
    mockGetInterview.mockResolvedValue({
      topic: "React 19 Hooks",
      style: "conversational",
      status: "live",
    });

    const result = await LiveWatchPage({ params: Promise.resolve({ id: "interview-123" }) });
    const html = renderToStaticMarkup(result);

    expect(html).toContain("Live Admin Watch");
    expect(html).toContain("React 19 Hooks");
  });
});
