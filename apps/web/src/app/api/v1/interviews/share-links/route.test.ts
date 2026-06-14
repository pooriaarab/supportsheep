import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());
const mockSendCalendarInviteEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/send-calendar-invite-email", () => ({
  sendCalendarInviteEmail: mockSendCalendarInviteEmail,
}));

// Mock Auth verify with AuthError
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

// Mock Audit Log
vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

// Tenancy mock — ctx.role is resolved from blog_members via resolveTenantForUser.
const tenantState = vi.hoisted(() => ({ role: "owner" }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(async () => null),
}));

// D1 share-links repo mocks
const mockCreateShareLink = vi.hoisted(() => vi.fn());
const mockListShareLinks = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/share-links-repository", () => ({
  createShareLink: mockCreateShareLink,
  listShareLinks: mockListShareLinks,
}));

// The route consults the workspace whoCanMintLinks setting (F-004).
const mockGetBlogConfigEffectiveMinters = vi.hoisted(() =>
  vi.fn(async () => ["owner", "admin", "editor"] as const),
);
vi.mock("@/lib/interviews/effective-minters", () => ({
  getBlogConfigEffectiveMinters: mockGetBlogConfigEffectiveMinters,
}));

describe("POST /api/v1/interviews/share-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantState.role = "owner";
    mockVerifyRequest.mockResolvedValue({
      uid: "user-creator-123",
      email: "creator@example.com",
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("should return 403 if user role lacks permission to mint", async () => {
    tenantState.role = "guest";

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links", {
      method: "POST",
      body: JSON.stringify({
        type: "link",
        style: "smart",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toEqual({ error: "forbidden" });
  });

  it("F-004: returns 403 for editors when the workspace whoCanMintLinks config excludes them", async () => {
    tenantState.role = "editor";
    mockGetBlogConfigEffectiveMinters.mockResolvedValueOnce([
      "owner",
      "admin",
    ] as never);

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links", {
      method: "POST",
      body: JSON.stringify({
        type: "link",
        style: "smart",
        authMode: "anonymous",
        recordingConfig: "transcript",
        maxDurationSec: 300,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toEqual({ error: "forbidden" });
  });

  it("should return 403 if user document does not exist (defaults to guest role)", async () => {
    tenantState.role = "viewer";

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links", {
      method: "POST",
      body: JSON.stringify({
        type: "link",
        style: "smart",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toEqual({ error: "forbidden" });
  });

  it("should successfully mint a share-link if user has permission", async () => {
    tenantState.role = "editor";
    mockCreateShareLink.mockResolvedValue({
      id: "test-share-link-id",
      blogId: "default",
      type: "link",
      createdBy: "user-creator-123",
      workspaceId: "default",
      topic: "Test TDD",
      goal: "Test goals",
      style: "smart",
      authMode: "anonymous",
      recordingConfig: "transcript",
      maxDurationSec: 300,
      maxUses: 5,
      uses: 0,
      status: "active",
      tokenHash: "hashed-token",
      language: "en",
      mode: "live",
      scheduledAt: null,
      scheduledGuestEmail: null,
      asyncQuestions: null,
      expiresAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links", {
      method: "POST",
      body: JSON.stringify({
        type: "link",
        topic: "Test TDD",
        goal: "Test goals",
        style: "smart",
        authMode: "anonymous",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        maxUses: 5,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("test-share-link-id");
    expect(json.token).toBeDefined();
    expect(json.token.length).toBeGreaterThanOrEqual(32);

    // Verify D1 repo called with correct fields
    expect(mockCreateShareLink).toHaveBeenCalledTimes(1);
    const [, savedData] = mockCreateShareLink.mock.calls[0];
    expect(savedData.type).toBe("link");
    expect(savedData.createdBy).toBe("user-creator-123");
    expect(savedData.tokenHash).toBeDefined();
    // Security check: Plaintext token must NEVER be persisted
    expect(savedData.token).toBeUndefined();
    expect(savedData.tokenHash).not.toBe(json.token);
  });

  it("should save scheduled fields and send calendar invite email if scheduledAt and scheduledGuestEmail are provided", async () => {
    tenantState.role = "editor";
    mockCreateShareLink.mockResolvedValue({
      id: "test-share-link-id",
      blogId: "default",
      type: "link",
      createdBy: "user-creator-123",
      workspaceId: "default",
      topic: "Test Scheduled TDD",
      goal: null,
      style: "smart",
      authMode: "anonymous",
      recordingConfig: "transcript",
      maxDurationSec: 300,
      maxUses: null,
      uses: 0,
      status: "active",
      tokenHash: "hashed-token",
      language: "en",
      mode: "live",
      scheduledAt: "2026-06-01T10:00:00.000Z",
      scheduledGuestEmail: "guest@example.com",
      asyncQuestions: null,
      expiresAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockSendCalendarInviteEmail.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links", {
      method: "POST",
      body: JSON.stringify({
        type: "link",
        topic: "Test Scheduled TDD",
        style: "smart",
        authMode: "anonymous",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        scheduledAt: "2026-06-01T10:00:00.000Z",
        scheduledGuestEmail: "guest@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    // Verify D1 repo called with scheduled fields
    expect(mockCreateShareLink).toHaveBeenCalledTimes(1);
    const [, savedData] = mockCreateShareLink.mock.calls[0];
    expect(savedData.scheduledAt).toBe("2026-06-01T10:00:00.000Z");
    expect(savedData.scheduledGuestEmail).toBe("guest@example.com");

    // Verify sendCalendarInviteEmail is triggered
    expect(mockSendCalendarInviteEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendCalendarInviteEmail.mock.calls[0][0];
    expect(emailArgs.to).toBe("guest@example.com");
    expect(emailArgs.ics).toContain("BEGIN:VCALENDAR");
    expect(emailArgs.ics).toContain("DTSTART:20260601T100000Z");
  });
});

describe("GET /api/v1/interviews/share-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantState.role = "owner";
    mockVerifyRequest.mockResolvedValue({
      uid: "user-creator-123",
      email: "creator@example.com",
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  function makeLink(id: string, createdBy: string) {
    return {
      id,
      blogId: "default",
      type: "link" as const,
      createdBy,
      workspaceId: "default",
      topic: null,
      goal: null,
      style: "smart" as const,
      authMode: "anonymous" as const,
      recordingConfig: "transcript" as const,
      maxDurationSec: 300,
      expiresAt: null,
      maxUses: null,
      uses: 0,
      status: "active" as const,
      tokenHash: `hash-${id}`,
      language: "en" as const,
      scheduledAt: null,
      scheduledGuestEmail: null,
      mode: "live" as const,
      asyncQuestions: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  it("should return workspace-scoped share links for owners and admins", async () => {
    tenantState.role = "admin";

    mockListShareLinks.mockResolvedValue([
      makeLink("link-1", "user-creator-123"),
      makeLink("link-2", "other-user"),
    ]);

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(2);

    // Verify no createdBy filter for admins
    const [, opts] = mockListShareLinks.mock.calls[0];
    expect(opts.createdBy).toBeUndefined();

    // Verify tokenHash is stripped from response
    expect(json.data[0].tokenHash).toBeUndefined();
    expect(json.data[1].tokenHash).toBeUndefined();
  });

  it("should scope share links to the creator for other roles", async () => {
    tenantState.role = "editor";

    mockListShareLinks.mockResolvedValue([
      makeLink("link-1", "user-creator-123"),
    ]);

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(1);

    // Verify creator scoping
    const [, opts] = mockListShareLinks.mock.calls[0];
    expect(opts.createdBy).toBe("user-creator-123");
  });

  it("should scope share links to the creator if user document does not exist", async () => {
    tenantState.role = "viewer";

    mockListShareLinks.mockResolvedValue([
      makeLink("link-1", "user-creator-123"),
    ]);

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(1);

    // Verify creator scoping (guest role → createdBy filter)
    const [, opts] = mockListShareLinks.mock.calls[0];
    expect(opts.createdBy).toBe("user-creator-123");
  });
});
