import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());

// Mock Auth
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: mockVerifyRequest,
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));

// Mock Audit Log
vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

// D1 repo mocks
const mockCreateInterview = vi.hoisted(() => vi.fn());
const mockListInterviews = vi.hoisted(() => vi.fn());
const mockGetShareLinkByTokenHash = vi.hoisted(() => vi.fn());
const mockAtomicIncrementUsesIfAvailable = vi.hoisted(() => vi.fn());
const mockListShareLinks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interviews-repository", () => ({
  createInterview: mockCreateInterview,
  listInterviews: mockListInterviews,
}));

vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLinkByTokenHash: mockGetShareLinkByTokenHash,
  atomicIncrementUsesIfAvailable: mockAtomicIncrementUsesIfAvailable,
  listShareLinks: mockListShareLinks,
  validateShareLinkForUse: vi.fn(() => null),
  isShareLinkScheduledFuture: vi.fn(() => false),
}));

// Tenancy — GET uses ctx.role (resolveTenantForUser); the auth:"none" POST
// self-flow and workspace-visibility checks read from getMembershipByUser.
const tenantState = vi.hoisted(() => ({ role: "owner" }));
const mockGetMembershipByUser = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: mockGetMembershipByUser,
}));

describe("POST /api/v1/interviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  describe("self-flow", () => {
    it("should create a self interview when user is authenticated", async () => {
      mockVerifyRequest.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });
      mockGetMembershipByUser.mockResolvedValue({
        blogId: "default",
        role: "owner",
      } as never);
      mockCreateInterview.mockResolvedValue({
        id: "test-interview-id",
        status: "consent",
        blogId: "default",
        style: "smart",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        topic: null,
        goal: null,
        language: "en",
        mode: "live",
        startedByUid: "user-123",
        startedByRole: "owner",
        shareLinkId: null,
        guestEmail: null,
        guestName: null,
        responsesCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const req = new NextRequest("http://localhost/api/v1/interviews", {
        method: "POST",
        body: JSON.stringify({
          self: true,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.interviewId).toBeTruthy();
      expect(json.status).toBe("consent");

      expect(mockVerifyRequest).toHaveBeenCalled();
      expect(mockCreateInterview).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          status: "consent",
          startedByUid: "user-123",
          startedByRole: "owner",
          style: "smart",
          recordingConfig: "transcript",
          maxDurationSec: 300,
          topic: null,
          goal: null,
          language: "en",
        }),
      );
    });

    it("should create a self interview with custom fields if provided", async () => {
      mockVerifyRequest.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });
      mockGetMembershipByUser.mockResolvedValue({
        blogId: "default",
        role: "owner",
      } as never);
      mockCreateInterview.mockResolvedValue({
        id: "test-interview-custom-id",
        status: "consent",
        blogId: "default",
        style: "testimonial",
        recordingConfig: "transcript",
        maxDurationSec: 600,
        topic: "My awesome topic",
        goal: null,
        language: "fr",
        mode: "live",
        startedByUid: "user-123",
        startedByRole: "owner",
        shareLinkId: null,
        guestEmail: null,
        guestName: null,
        responsesCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const req = new NextRequest("http://localhost/api/v1/interviews", {
        method: "POST",
        body: JSON.stringify({
          self: true,
          style: "testimonial",
          topic: "My awesome topic",
          maxDurationSec: 600,
          language: "fr",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.interviewId).toBeTruthy();
      expect(json.status).toBe("consent");

      expect(mockVerifyRequest).toHaveBeenCalled();
      expect(mockCreateInterview).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          status: "consent",
          startedByUid: "user-123",
          startedByRole: "owner",
          style: "testimonial",
          recordingConfig: "transcript",
          maxDurationSec: 600,
          topic: "My awesome topic",
          goal: null,
          language: "fr",
        }),
      );
    });

    it("should return 401 if user is not authenticated for self-flow", async () => {
      mockVerifyRequest.mockRejectedValue(new Error("Unauthorized"));

      const req = new NextRequest("http://localhost/api/v1/interviews", {
        method: "POST",
        body: JSON.stringify({
          self: true,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe("share-link flow", () => {
    it("should create interview on a valid anonymous share-link", async () => {
      const mockShareLinkData = {
        id: "share-link-123",
        blogId: "default",
        style: "testimonial",
        recordingConfig: "audio",
        maxDurationSec: 600,
        topic: "Test Topic",
        goal: "Test Goal",
        authMode: "anonymous",
        status: "active",
        uses: 0,
        maxUses: null,
        expiresAt: null,
        language: "es",
        mode: "live",
        type: "link",
        tokenHash: "hashed",
        createdBy: "user-1",
        workspaceId: "default",
        scheduledAt: null,
        scheduledGuestEmail: null,
        asyncQuestions: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockGetShareLinkByTokenHash.mockResolvedValue(mockShareLinkData);
      mockAtomicIncrementUsesIfAvailable.mockResolvedValue(true);
      mockCreateInterview.mockResolvedValue({
        id: "test-interview-id",
        status: "consent",
        blogId: "default",
        shareLinkId: "share-link-123",
        style: "testimonial",
        recordingConfig: "audio",
        maxDurationSec: 600,
        topic: "Test Topic",
        goal: "Test Goal",
        language: "es",
        mode: "live",
        startedByUid: null,
        startedByRole: null,
        guestEmail: null,
        guestName: null,
        responsesCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const req = new NextRequest("http://localhost/api/v1/interviews", {
        method: "POST",
        body: JSON.stringify({
          shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.interviewId).toBeTruthy();
      expect(json.status).toBe("consent");

      expect(mockCreateInterview).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          status: "consent",
          shareLinkId: "share-link-123",
          style: "testimonial",
          recordingConfig: "audio",
          maxDurationSec: 600,
          topic: "Test Topic",
          goal: "Test Goal",
          language: "es",
          mode: "live",
        }),
      );
    });

    it("should propagate mode: async if share-link is async", async () => {
      const mockShareLinkData = {
        id: "share-link-async",
        blogId: "default",
        status: "active",
        type: "link",
        authMode: "anonymous",
        uses: 0,
        maxUses: null,
        expiresAt: null,
        language: "en",
        mode: "async",
        style: "smart",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        topic: null,
        goal: null,
        tokenHash: "hashed",
        createdBy: "user-1",
        workspaceId: "default",
        scheduledAt: null,
        scheduledGuestEmail: null,
        asyncQuestions: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockGetShareLinkByTokenHash.mockResolvedValue(mockShareLinkData);
      mockAtomicIncrementUsesIfAvailable.mockResolvedValue(true);
      mockCreateInterview.mockResolvedValue({
        id: "test-interview-id",
        status: "consent",
        blogId: "default",
        shareLinkId: "share-link-async",
        mode: "async",
        style: "smart",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        topic: null,
        goal: null,
        language: "en",
        startedByUid: null,
        startedByRole: null,
        guestEmail: null,
        guestName: null,
        responsesCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const req = new NextRequest("http://localhost/api/v1/interviews", {
        method: "POST",
        body: JSON.stringify({
          shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockCreateInterview).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          shareLinkId: "share-link-async",
          mode: "async",
        }),
      );
    });

    it("should return 404 if share-link does not exist", async () => {
      mockGetShareLinkByTokenHash.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/v1/interviews", {
        method: "POST",
        body: JSON.stringify({
          shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it("should return 400 if authMode is email and guestEmail is missing", async () => {
      const mockShareLinkData = {
        id: "share-link-123",
        blogId: "default",
        authMode: "email",
        status: "active",
        uses: 0,
        maxUses: null,
        expiresAt: null,
        type: "link",
        tokenHash: "hashed",
        style: "smart",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        topic: null,
        goal: null,
        language: "en",
        mode: "live",
        createdBy: "user-1",
        workspaceId: "default",
        scheduledAt: null,
        scheduledGuestEmail: null,
        asyncQuestions: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockGetShareLinkByTokenHash.mockResolvedValue(mockShareLinkData);

      const req = new NextRequest("http://localhost/api/v1/interviews", {
        method: "POST",
        body: JSON.stringify({
          shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("email_required");
    });

    it("should return 400 if authMode is magic_link (not supported yet)", async () => {
      const mockShareLinkData = {
        id: "share-link-123",
        blogId: "default",
        authMode: "magic_link",
        status: "active",
        uses: 0,
        maxUses: null,
        expiresAt: null,
        type: "link",
        tokenHash: "hashed",
        style: "smart",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        topic: null,
        goal: null,
        language: "en",
        mode: "live",
        createdBy: "user-1",
        workspaceId: "default",
        scheduledAt: null,
        scheduledGuestEmail: null,
        asyncQuestions: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockGetShareLinkByTokenHash.mockResolvedValue(mockShareLinkData);

      const req = new NextRequest("http://localhost/api/v1/interviews", {
        method: "POST",
        body: JSON.stringify({
          shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("magic_link_required");
    });
  });
});

describe("GET /api/v1/interviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({
      uid: "user-123",
      email: "user@example.com",
    });
    tenantState.role = "admin";
  });

  it("should return merged past interviews and scheduled share links", async () => {
    mockListInterviews.mockResolvedValue([
      {
        id: "interview-1",
        status: "ended",
        topic: "Past Interview",
        style: "smart",
        guestName: "Old Guest",
        startedByUid: "user-123",
        maxDurationSec: 300,
        createdAt: new Date("2026-05-01T12:00:00.000Z").getTime(),
        updatedAt: new Date("2026-05-01T12:00:00.000Z").getTime(),
      },
    ]);

    mockListShareLinks.mockResolvedValue([
      {
        id: "share-link-scheduled-123",
        status: "active",
        topic: "Scheduled Interview",
        style: "qa",
        scheduledAt: "2026-06-01T10:00:00.000Z",
        scheduledGuestEmail: "scheduled@example.com",
        uses: 0,
        createdBy: "user-123",
        maxDurationSec: 300,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const req = new NextRequest("http://localhost/api/v1/interviews", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data).toBeDefined();
    expect(json.data.length).toBe(2);

    expect(json.data[0].id).toBe("scheduled-share-link-scheduled-123");
    expect(json.data[0].status).toBe("scheduled");
    expect(json.data[0].topic).toBe("Scheduled Interview");
    expect(json.data[0].guestName).toBe("scheduled@example.com");

    expect(json.data[1].id).toBe("interview-1");
    expect(json.data[1].status).toBe("ended");
  });
});
