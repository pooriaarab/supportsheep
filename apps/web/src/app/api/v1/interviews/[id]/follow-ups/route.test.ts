import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockSuggestFollowUps = vi.hoisted(() => vi.fn());

// Mock Auth
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: mockVerifyRequest,
}));

// Mock Suggester
vi.mock("@/lib/interviews/follow-up-suggester", () => ({
  suggestFollowUps: mockSuggestFollowUps,
}));

// Tenancy role resolution for createApiHandler. Each test sets
// `tenantState.role` to drive the 403 vs success branches.
const tenantState = vi.hoisted(() => ({ role: "owner" as string }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(),
}));

// D1 interview + event repositories.
const mockGetInterview = vi.hoisted(() => vi.fn());
const mockListAllEvents = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
}));

vi.mock("@/lib/interviews/events-repository", () => ({
  listAllEvents: mockListAllEvents,
}));

describe("POST /api/v1/interviews/[id]/follow-ups", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Authenticated user mock
    mockVerifyRequest.mockResolvedValue({
      uid: "test-user-123",
      email: "test@example.com",
    });

    // Default: write-capable role
    tenantState.role = "admin";

    // Default: Interview exists
    mockGetInterview.mockResolvedValue({
      status: "live",
      topic: "React testing",
      style: "probing",
    });

    // Default: Recent events
    mockListAllEvents.mockResolvedValue([
      {
        kind: "transcript_user",
        payload: { text: "We should use TDD." },
      },
      {
        kind: "transcript_ai",
        payload: { text: "Why is TDD important?" },
      },
    ]);

    // Default: Suggestions output
    mockSuggestFollowUps.mockResolvedValue([
      { text: "Do you always use TDD?", rationale: "Probing further" },
    ]);
  });

  it("should reject with 403 if user has a non-admin/editor/owner role", async () => {
    tenantState.role = "viewer";

    const req = new NextRequest("http://localhost/api/v1/interviews/test-id/follow-ups", {
      method: "Article",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("should allow access and return suggestions with admin/editor/owner role", async () => {
    tenantState.role = "editor";

    const req = new NextRequest("http://localhost/api/v1/interviews/test-id/follow-ups", {
      method: "Article",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      suggestions: [
        { text: "Do you always use TDD?", rationale: "Probing further" },
      ],
    });

    expect(mockSuggestFollowUps).toHaveBeenCalledWith({
      topic: "React testing",
      style: "probing",
      transcript: "Guest: We should use TDD.\nInterviewer: Why is TDD important?",
    });
  });

  it("should reject with 404 if interview does not exist", async () => {
    mockGetInterview.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/v1/interviews/missing-id/follow-ups", {
      method: "Article",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "missing-id" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Interview not found");
  });

  it("should rate limit requests to once per 30s per interview", async () => {
    const req1 = new NextRequest("http://localhost/api/v1/interviews/rate-limit-id/follow-ups", {
      method: "Article",
    });
    const res1 = await POST(req1, { params: Promise.resolve({ id: "rate-limit-id" }) });
    expect(res1.status).toBe(200);

    const req2 = new NextRequest("http://localhost/api/v1/interviews/rate-limit-id/follow-ups", {
      method: "Article",
    });
    const res2 = await POST(req2, { params: Promise.resolve({ id: "rate-limit-id" }) });
    expect(res2.status).toBe(429);
    const json = await res2.json();
    expect(json.error).toBe("rate_limit_exceeded");
  });
});
