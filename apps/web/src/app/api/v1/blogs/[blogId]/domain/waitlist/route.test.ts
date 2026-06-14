import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyRequest = vi.fn();
const mockLogAuditEvent = vi.fn();
const mockResolveTenant = vi.fn();
const mockJoinDomainWaitlist = vi.fn();
const mockIsBlogOnWaitlist = vi.fn();
const mockCountDomainWaitlist = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public status = 401,
    ) {
      super(message);
      this.name = "AuthError";
    }
  },
  verifyRequest: mockVerifyRequest,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  resolveTenantForUser: mockResolveTenant,
  DEFAULT_BLOG_ID: "default",
  NeedsOnboardingError: class NeedsOnboardingError extends Error {},
}));

vi.mock("@/lib/domains/waitlist-repository", () => ({
  joinDomainWaitlist: mockJoinDomainWaitlist,
  isBlogOnWaitlist: mockIsBlogOnWaitlist,
  countDomainWaitlist: mockCountDomainWaitlist,
}));

// The POST handler resolves email from the session, so getDb is never touched
// in these tests — stub it so the import resolves.
vi.mock("@/db", () => ({ getDb: vi.fn() }));

function request(method: "GET" | "POST"): Request {
  return new Request("http://test.local/api/v1/blogs/blog-1/domain/waitlist", {
    method,
  });
}

const params = (blogId: string) => ({ params: Promise.resolve({ blogId }) });

describe("domain waitlist route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({
      uid: "u-1",
      email: "owner@supportsheep.com",
      authTime: 0,
    });
    mockResolveTenant.mockResolvedValue({ blogId: "blog-1", role: "admin" });
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockJoinDomainWaitlist.mockResolvedValue(undefined);
    mockIsBlogOnWaitlist.mockResolvedValue(false);
    mockCountDomainWaitlist.mockResolvedValue(3);
  });

  describe("GET", () => {
    it("returns joined + total interested count for a member", async () => {
      mockIsBlogOnWaitlist.mockResolvedValue(true);
      const route = await import("./route");
      const res = await route.GET(request("GET") as never, params("blog-1") as never);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        joined: true,
        totalInterested: 3,
      });
    });

    it("allows non-owner members (viewer) to read", async () => {
      mockResolveTenant.mockResolvedValue({ blogId: "blog-1", role: "viewer" });
      const route = await import("./route");
      const res = await route.GET(request("GET") as never, params("blog-1") as never);
      expect(res.status).toBe(200);
    });

    it("returns 401 when unauthenticated", async () => {
      const { AuthError } = await import("@/lib/auth/session");
      mockVerifyRequest.mockRejectedValue(new AuthError("unauthorized", 401));
      const route = await import("./route");
      const res = await route.GET(request("GET") as never, params("blog-1") as never);
      expect(res.status).toBe(401);
    });

    it("returns 403 for a path blogId that is not the caller's tenant", async () => {
      const route = await import("./route");
      const res = await route.GET(
        request("GET") as never,
        params("other-blog") as never,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("POST", () => {
    it("joins the waitlist and returns the count", async () => {
      const route = await import("./route");
      const res = await route.POST(request("POST") as never, params("blog-1") as never);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        joined: true,
        totalInterested: 3,
      });
      expect(mockJoinDomainWaitlist).toHaveBeenCalledWith({
        blogId: "blog-1",
        userId: "u-1",
        email: "owner@supportsheep.com",
      });
    });

    it("is idempotent — a second join still returns joined:true", async () => {
      const route = await import("./route");
      await route.POST(request("POST") as never, params("blog-1") as never);
      const res = await route.POST(request("POST") as never, params("blog-1") as never);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ joined: true });
      expect(mockJoinDomainWaitlist).toHaveBeenCalledTimes(2);
    });

    it("returns 403 for a non-owner/admin member", async () => {
      mockResolveTenant.mockResolvedValue({ blogId: "blog-1", role: "editor" });
      const route = await import("./route");
      const res = await route.POST(request("POST") as never, params("blog-1") as never);
      expect(res.status).toBe(403);
      expect(mockJoinDomainWaitlist).not.toHaveBeenCalled();
    });

    it("returns 403 for a path blogId that is not the caller's tenant", async () => {
      const route = await import("./route");
      const res = await route.POST(
        request("POST") as never,
        params("other-blog") as never,
      );
      expect(res.status).toBe(403);
      expect(mockJoinDomainWaitlist).not.toHaveBeenCalled();
    });

    it("returns 401 when unauthenticated", async () => {
      const { AuthError } = await import("@/lib/auth/session");
      mockVerifyRequest.mockRejectedValue(new AuthError("unauthorized", 401));
      const route = await import("./route");
      const res = await route.POST(request("POST") as never, params("blog-1") as never);
      expect(res.status).toBe(401);
    });
  });
});
