import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/seo/analytics/google/route";

vi.mock("@/lib/auth/session", () => ({
  verifyRequest: vi.fn().mockResolvedValue({
    uid: "user-id",
    email: "user@example.com",
    authTime: Date.now(),
  }),
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(() => Promise.resolve()),
}));

describe("GET /api/v1/seo/analytics/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a zeroed empty-state payload (analytics source removed in CF migration)", async () => {
    const response = await GET(
      new NextRequest("https://blogbat.com/api/v1/seo/analytics/google"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.ga4).toEqual({
      pageViews: 0,
      sessions: 0,
      engagementRate: 0,
      topPages: [],
    });
    expect(body.data.gsc).toEqual({
      clicks: 0,
      impressions: 0,
      averagePosition: 0,
      topQueries: [],
    });
  });
});
