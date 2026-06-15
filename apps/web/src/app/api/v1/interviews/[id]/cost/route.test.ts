import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockAggregateUsage = vi.hoisted(() => vi.fn());

// Mock Auth
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

// Mock Aggregator
vi.mock("@/lib/interviews/aggregate-usage", () => ({
  aggregateUsage: mockAggregateUsage,
}));

// Mock D1 interviews repository
const mockGetInterview = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
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

describe("GET /api/v1/interviews/[id]/cost", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    mockVerifyRequest.mockResolvedValue({
      uid: "test-user-123",
      email: "test@example.com",
    });

    // Default: write-capable role
    tenantState.role = "admin";

    // Default: zero-usage aggregator
    mockAggregateUsage.mockResolvedValue({
      realtime: { input: 0, output: 0 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });
  });

  it("should reject with 403 if user has a non-admin/editor/owner role", async () => {
    tenantState.role = "viewer";

    const req = new NextRequest("http://localhost/api/v1/interviews/test-id/cost");
    const res = await GET(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("should allow access with editor role", async () => {
    tenantState.role = "editor";

    mockGetInterview.mockResolvedValue({
      id: "test-id",
      blogId: "default",
      status: "ended",
      costUsd: 0.15,
      endedAt: Date.now(),
      startedAt: Date.now() - 120_000,
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/test-id/cost");
    const res = await GET(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(200);
  });

  it("should return 404 if interview is not found", async () => {
    mockGetInterview.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/v1/interviews/test-id/cost");
    const res = await GET(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Interview not found");
  });

  it("should return persisted values for an ended interview and still expose status + breakdown", async () => {
    mockGetInterview.mockResolvedValue({
      id: "ended-id",
      blogId: "default",
      status: "ended",
      costUsd: 0.25,
      endedAt: new Date("2026-05-22T10:00:00Z").getTime(),
      startedAt: new Date("2026-05-22T09:50:00Z").getTime(),
    });

    mockAggregateUsage.mockResolvedValue({
      realtime: { input: 0, output: 0 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/ended-id/cost");
    const res = await GET(req, { params: Promise.resolve({ id: "ended-id" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("ended");
    expect(json.endedAt).toBe("2026-05-22T10:00:00.000Z");
    expect(json.costUsd).toBe(0.25);
    expect(json.durationSec).toBe(600);
    expect(json.breakdown).toEqual({ realtimeCostUsd: 0, writerCostUsd: 0 });
  });

  it("should compute on-the-fly and return values for live interview, calling aggregateUsage", async () => {
    mockGetInterview.mockResolvedValue({
      id: "live-id",
      blogId: "default",
      status: "live",
      costUsd: null,
      startedAt: Date.now() - 300_000,
      endedAt: null,
    });

    mockAggregateUsage.mockResolvedValue({
      // gpt-realtime audio: (1000*32)/1M + (500*64)/1M = 0.032 + 0.032 = $0.064
      realtime: { input: 1000, output: 500 },
      // Claude Sonnet 4.6: (10000*3)/1M + (5000*0.3)/1M + (2000*15)/1M
      // = 0.03 + 0.0015 + 0.03 = $0.0615
      writer: { input: 10000, cachedInput: 5000, output: 2000 },
    }); // total cost = 0.064 + 0.0615 = 0.1255

    const req = new NextRequest("http://localhost/api/v1/interviews/live-id/cost");
    const res = await GET(req, { params: Promise.resolve({ id: "live-id" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.costUsd).toBe(0.1255);
    expect(json.realtimeTokens).toBe(1500);
    expect(json.writerTokens).toBe(17000);
    expect(json.durationSec).toBeCloseTo(300, 0);
    expect(json.status).toBe("live");
    expect(json.breakdown.realtimeCostUsd).toBeCloseTo(0.064, 4);
    expect(json.breakdown.writerCostUsd).toBeCloseTo(0.0615, 4);

    expect(mockAggregateUsage).toHaveBeenCalledWith("default", "live-id");
  });

  it("should return zero values on-the-fly if live interview has no events", async () => {
    mockGetInterview.mockResolvedValue({
      id: "live-id",
      blogId: "default",
      status: "live",
      costUsd: null,
      startedAt: null,
      endedAt: null,
    });

    mockAggregateUsage.mockResolvedValue({
      realtime: { input: 0, output: 0 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/live-id/cost");
    const res = await GET(req, { params: Promise.resolve({ id: "live-id" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.costUsd).toBe(0);
    expect(json.realtimeTokens).toBe(0);
    expect(json.writerTokens).toBe(0);
    expect(json.durationSec).toBe(0);
    expect(json.status).toBe("live");
    expect(json.breakdown).toEqual({ realtimeCostUsd: 0, writerCostUsd: 0 });
  });
});
