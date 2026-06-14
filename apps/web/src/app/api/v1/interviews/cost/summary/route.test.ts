import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockGetBlogConfig = vi.hoisted(() => vi.fn());

// Mock Auth
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: mockVerifyRequest,
}));

// Mock Blog Config
vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mockGetBlogConfig,
}));

// Tenancy mock — ctx.role is resolved from blog_members via resolveTenantForUser.
const tenantState = vi.hoisted(() => ({ role: "admin" }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(async () => null),
}));

// Mock D1 getDb / interviews table queries
const mockDbSelect = vi.hoisted(() => vi.fn());
vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    select: mockDbSelect,
  })),
}));

// Mock aggregateUsage so the live-session fold-in doesn't try to read
// per-interview events during these summary tests.
const mockAggregateUsage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/aggregate-usage", () => ({
  aggregateUsage: mockAggregateUsage,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(),
}));

describe("GET /api/v1/interviews/cost/summary", () => {
  // D1 drizzle query chain: db.select().from(...).where(...) → rows
  function setupDbReturns(endedRows: unknown[], liveRows: unknown[]) {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      const rows = callCount === 1 ? endedRows : liveRows;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      };
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tenantState.role = "admin";

    // Pin the clock to a fixed mid-month UTC instant for deterministic date math.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    // Default: Authenticated user
    mockVerifyRequest.mockResolvedValue({
      uid: "test-user-123",
      email: "test@example.com",
    });

    // Default: Blog config mock
    mockGetBlogConfig.mockResolvedValue({
      interview: {
        monthlyCostCapUsd: 100,
      },
    });

    // Default: empty rows for both queries
    setupDbReturns([], []);

    // Default: live aggregation stub
    mockAggregateUsage.mockResolvedValue({
      realtime: { input: 0, output: 0 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should reject with 403 if user has non-admin/editor/owner role", async () => {
    tenantState.role = "viewer";

    const req = new NextRequest("http://localhost/api/v1/interviews/cost/summary");
    const res = await GET(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("should return correct metrics structure even if there are no interviews", async () => {
    const req = new NextRequest("http://localhost/api/v1/interviews/cost/summary");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("thisMonth");
    expect(json).toHaveProperty("byDay");
    expect(json).toHaveProperty("byMonth");

    expect(json.thisMonth).toEqual({
      totalUsd: 0,
      totalInterviews: 0,
      capUsd: 100,
      capUtilizationPct: 0,
    });

    // Should return 30 items for byDay and 12 for byMonth
    expect(json.byDay).toHaveLength(30);
    expect(json.byMonth).toHaveLength(12);

    // Verify day and month string formats
    expect(json.byDay[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(json.byMonth[0].month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("should aggregate cost and count of interviews correctly", async () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const endedRows = [
      {
        id: "iv-1",
        blogId: "default",
        status: "ended",
        endedAt: today.getTime(),
        costUsd: 1.5,
        createdAt: today.getTime(),
        updatedAt: today.getTime(),
      },
      {
        id: "iv-2",
        blogId: "default",
        status: "ended",
        endedAt: yesterday.getTime(),
        costUsd: 2.0,
        createdAt: yesterday.getTime(),
        updatedAt: yesterday.getTime(),
      },
      {
        id: "iv-3",
        blogId: "default",
        status: "ended",
        endedAt: twoMonthsAgo.getTime(),
        costUsd: 10.5,
        createdAt: twoMonthsAgo.getTime(),
        updatedAt: twoMonthsAgo.getTime(),
      },
    ];

    setupDbReturns(endedRows, []); // ended rows on first query, empty live on second

    const req = new NextRequest("http://localhost/api/v1/interviews/cost/summary");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();

    // Verify this month's calculations
    const currentMonthStr = today.toISOString().substring(0, 7);
    const yesterdayMonthStr = yesterday.toISOString().substring(0, 7);

    let expectedThisMonthCost = 1.5;
    let expectedThisMonthCount = 1;
    if (currentMonthStr === yesterdayMonthStr) {
      expectedThisMonthCost += 2.0;
      expectedThisMonthCount += 1;
    }

    expect(json.thisMonth.totalUsd).toBe(expectedThisMonthCost);
    expect(json.thisMonth.totalInterviews).toBe(expectedThisMonthCount);
    expect(json.thisMonth.capUtilizationPct).toBe(expectedThisMonthCost);

    // Verify byMonth aggregation for two months ago
    const targetMonthStr = twoMonthsAgo.toISOString().substring(0, 7);
    const monthData = json.byMonth.find(
      (m: { month: string; costUsd: number; interviews: number }) =>
        m.month === targetMonthStr,
    );
    expect(monthData).toBeDefined();
    expect(monthData?.costUsd).toBe(10.5);
    expect(monthData?.interviews).toBe(1);

    // Verify byDay aggregation for today and yesterday
    const todayStr = today.toISOString().substring(0, 10);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);

    const todayData = json.byDay.find(
      (d: { date: string; costUsd: number; interviews: number }) => d.date === todayStr,
    );
    expect(todayData).toBeDefined();
    expect(todayData?.costUsd).toBe(1.5);
    expect(todayData?.interviews).toBe(1);

    const yesterdayData = json.byDay.find(
      (d: { date: string; costUsd: number; interviews: number }) => d.date === yesterdayStr,
    );
    expect(yesterdayData).toBeDefined();
    expect(yesterdayData?.costUsd).toBe(2.0);
    expect(yesterdayData?.interviews).toBe(1);
  });

  it("should fold in-flight live sessions into this month's running total", async () => {
    const liveRows = [
      {
        id: "live-interview-1",
        blogId: "default",
        status: "live",
        endedAt: null,
        costUsd: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    setupDbReturns([], liveRows); // empty ended, live row on second query

    // 100k input audio × $32/M + 100k output audio × $64/M
    // = $3.20 + $6.40 = $9.60
    mockAggregateUsage.mockResolvedValue({
      realtime: { input: 100_000, output: 100_000 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/cost/summary");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.thisMonth.totalUsd).toBeCloseTo(9.6, 2);
    expect(json.thisMonth.totalInterviews).toBe(1);
    expect(mockAggregateUsage).toHaveBeenCalledWith(
      expect.any(String),
      "live-interview-1",
    );
  });

  it("should handle null monthlyCostCapUsd correctly", async () => {
    mockGetBlogConfig.mockResolvedValue({
      interview: {
        monthlyCostCapUsd: null,
      },
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/cost/summary");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.thisMonth.capUsd).toBeNull();
    expect(json.thisMonth.capUtilizationPct).toBeNull();
  });
});
