import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

const mockSendMagicLinkEmail = vi.hoisted(() => vi.fn());
const mockGenerateMagicLinkToken = vi.hoisted(() =>
  vi.fn(() => ({ token: "magic_plaintext", hash: "magic_hashed" })),
);
const mockHashMagicLinkToken = vi.hoisted(() => vi.fn(() => "magic_hashed"));
const mockHashShareLinkToken = vi.hoisted(() => vi.fn(() => "share_hashed"));
const mockCheckRateLimit = vi.hoisted(() =>
  vi.fn(async () => ({
    allowed: true,
    limit: 5,
    remaining: 5,
    resetAt: Date.now() + 60_000,
  })),
);

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: {
    "share-link-by-token": 60,
    "interview-consent": 10,
    "interview-events": 120,
    "interview-end": 10,
    "interview-magic-link": 5,
  },
  RATE_LIMIT_WINDOW_MS: 60_000,
}));

// Mock send magic link email
vi.mock("@/lib/interviews/send-magic-link-email", () => ({
  sendMagicLinkEmail: mockSendMagicLinkEmail,
}));

// Mock tokens
vi.mock("@/lib/interviews/magic-link-token", () => ({
  generateMagicLinkToken: mockGenerateMagicLinkToken,
  hashMagicLinkToken: mockHashMagicLinkToken,
}));

vi.mock("@/lib/interviews/share-link-token", () => ({
  hashShareLinkToken: mockHashShareLinkToken,
}));

// Mock Auth (required by create-api-handler)
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));

// D1 share-links repo mocks
const mockGetShareLinkByTokenHash = vi.hoisted(() => vi.fn());
const mockAtomicIncrementUsesIfAvailable = vi.hoisted(() => vi.fn());
const mockCreateInterview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLinkByTokenHash: mockGetShareLinkByTokenHash,
  atomicIncrementUsesIfAvailable: mockAtomicIncrementUsesIfAvailable,
}));

vi.mock("@/lib/interviews/interviews-repository", () => ({
  createInterview: mockCreateInterview,
}));

// D1 magic-links repo mocks — no firebase for magic_links in 0D
const mockCreateMagicLink = vi.hoisted(() => vi.fn());
const mockClaimMagicLink = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/magic-links-repository", () => ({
  createMagicLink: mockCreateMagicLink,
  claimMagicLink: mockClaimMagicLink,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(),
}));

function makeShareLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "share-link-123",
    blogId: "default",
    status: "active",
    authMode: "magic_link",
    type: "link",
    createdBy: "user-1",
    workspaceId: "default",
    tokenHash: "share_hashed",
    style: "smart",
    recordingConfig: "transcript",
    maxDurationSec: 300,
    topic: null,
    goal: null,
    language: "en",
    mode: "live",
    uses: 0,
    maxUses: null,
    expiresAt: null,
    scheduledAt: null,
    scheduledGuestEmail: null,
    asyncQuestions: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("POST /api/v1/interviews/magic-link (Send)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send magic link email when share link is active and mode is magic_link", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink());
    mockCreateMagicLink.mockResolvedValue({
      id: "ml-id",
      blogId: "default",
      shareLinkId: "share-link-123",
      tokenHash: "magic_hashed",
      email: "guest@example.com",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      consumedAt: null,
      createdAt: Date.now(),
    });
    mockSendMagicLinkEmail.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/v1/interviews/magic-link", {
      method: "POST",
      body: JSON.stringify({
        shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        email: "guest@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);

    expect(mockHashShareLinkToken).toHaveBeenCalledWith(
      "this-is-a-valid-token-at-least-32-chars-long",
    );
    expect(mockGetShareLinkByTokenHash).toHaveBeenCalledWith("share_hashed");

    // Verify D1 createMagicLink called with correct fields
    expect(mockCreateMagicLink).toHaveBeenCalledTimes(1);
    const [blogId, mlInput] = mockCreateMagicLink.mock.calls[0];
    expect(blogId).toBe("default");
    expect(mlInput.shareLinkId).toBe("share-link-123");
    expect(mlInput.tokenHash).toBe("magic_hashed");
    expect(mlInput.email).toBe("guest@example.com");
    expect(mlInput.expiresAt).toBeDefined();

    expect(mockSendMagicLinkEmail).toHaveBeenCalledWith({
      to: "guest@example.com",
      shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
      magicLinkToken: "magic_plaintext",
      shareLinkId: "share-link-123",
      magicLinkId: "magic_hashed",
    });
  });

  it("should return 404 if share link is not found", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/v1/interviews/magic-link", {
      method: "POST",
      body: JSON.stringify({
        shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        email: "guest@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("should return 404 if share link is inactive", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink({ status: "revoked" }));

    const req = new NextRequest("http://localhost/api/v1/interviews/magic-link", {
      method: "POST",
      body: JSON.stringify({
        shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        email: "guest@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("should return 404 if authMode is not magic_link", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink({ authMode: "email" }));

    const req = new NextRequest("http://localhost/api/v1/interviews/magic-link", {
      method: "POST",
      body: JSON.stringify({
        shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        email: "guest@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/interviews/magic-link (Redeem)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redeem magic link and redirect to consent on success", async () => {
    const shareLinkData = makeShareLink({
      uses: 1,
      maxUses: 10,
      style: "case_study",
      recordingConfig: "transcript",
      maxDurationSec: 450,
      topic: "Topic 1",
      goal: "Goal 1",
    });

    mockGetShareLinkByTokenHash.mockResolvedValue(shareLinkData);
    // D1 atomic claim succeeds
    mockClaimMagicLink.mockResolvedValue({
      ok: true,
      email: "guest@example.com",
      row: {
        id: "ml-id",
        blogId: "default",
        shareLinkId: "share-link-123",
        tokenHash: "magic_hashed",
        email: "guest@example.com",
        expiresAt: new Date(Date.now() + 50000).toISOString(),
        consumedAt: Date.now(),
        createdAt: Date.now() - 100,
      },
    });
    mockAtomicIncrementUsesIfAvailable.mockResolvedValue(true);
    mockCreateInterview.mockResolvedValue({
      id: "test-interview-id",
      status: "consent",
      blogId: "default",
      shareLinkId: "share-link-123",
      style: "case_study",
      recordingConfig: "transcript",
      maxDurationSec: 450,
      topic: "Topic 1",
      goal: "Goal 1",
      guestEmail: "guest@example.com",
      language: "en",
      mode: "live",
      startedByUid: null,
      startedByRole: null,
      guestName: null,
      responsesCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/magic-link?share=some_share_token&code=some_magic_code",
    );

    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(
      "/i/some_share_token/consent?interview=test-interview-id",
    );

    expect(mockClaimMagicLink).toHaveBeenCalledWith("default", "magic_hashed");
    expect(mockAtomicIncrementUsesIfAvailable).toHaveBeenCalledWith(
      "default",
      "share-link-123",
      1,
      10,
    );

    expect(mockCreateInterview).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        shareLinkId: "share-link-123",
        guestEmail: "guest@example.com",
        style: "case_study",
        recordingConfig: "transcript",
        maxDurationSec: 450,
        topic: "Topic 1",
        goal: "Goal 1",
      }),
    );
  });

  it(
    "blocks concurrent double-redeem of the same code (default maxUses=null): " +
      "second claim returns 409 and does NOT create a second interview",
    async () => {
      // maxUses=null is the schema default, so atomicIncrementUsesIfAvailable
      // canNOT block double-redeem — the atomic consumedAt CLAIM must.
      const shareLinkData = makeShareLink({ uses: 0, maxUses: null });
      mockGetShareLinkByTokenHash.mockResolvedValue(shareLinkData);

      // Simulate atomic D1 CAS: first call claims (ok: true), second gets consumed (ok: false).
      // This is exactly the behavior of the conditional UPDATE … WHERE consumed_at IS NULL.
      let claimed = false;
      mockClaimMagicLink.mockImplementation(async () => {
        if (!claimed) {
          claimed = true;
          return {
            ok: true,
            email: "guest@example.com",
            row: {
              id: "ml-id",
              blogId: "default",
              shareLinkId: "share-link-123",
              tokenHash: "magic_hashed",
              email: "guest@example.com",
              expiresAt: new Date(Date.now() + 50_000).toISOString(),
              consumedAt: Date.now(),
              createdAt: Date.now() - 100,
            },
          };
        }
        return { ok: false, reason: "consumed" };
      });

      // maxUses=null → unconditional increment; cannot block double-redeem
      mockAtomicIncrementUsesIfAvailable.mockResolvedValue(true);
      mockCreateInterview.mockResolvedValue({
        id: "interview-once",
        status: "consent",
        blogId: "default",
        shareLinkId: "share-link-123",
        guestEmail: "guest@example.com",
        style: "smart",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        topic: null,
        goal: null,
        language: "en",
        mode: "live",
        startedByUid: null,
        startedByRole: null,
        guestName: null,
        responsesCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const makeReq = () =>
        new NextRequest(
          "http://localhost/api/v1/interviews/magic-link?share=some_share_token&code=some_magic_code",
        );

      const first = await GET(makeReq());
      const second = await GET(makeReq());

      expect(first.status).toBe(302);
      expect(second.status).toBe(409);

      // The single-redeem invariant: exactly one interview created.
      expect(mockCreateInterview).toHaveBeenCalledTimes(1);
    },
  );

  it("should return 400 if params are missing", async () => {
    const req = new NextRequest("http://localhost/api/v1/interviews/magic-link?share=foo");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("should return 404 if share link not found", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/magic-link?share=some_share_token&code=some_magic_code",
    );

    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("should return 404 if magic link not found", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink());
    mockClaimMagicLink.mockResolvedValue({ ok: false, reason: "not_found" });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/magic-link?share=some_share_token&code=some_magic_code",
    );

    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("should return 409 if magic link already consumed", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink());
    mockClaimMagicLink.mockResolvedValue({ ok: false, reason: "consumed" });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/magic-link?share=some_share_token&code=some_magic_code",
    );

    const res = await GET(req);
    expect(res.status).toBe(409);
  });

  it("should return 410 if magic link expired", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink());
    mockClaimMagicLink.mockResolvedValue({ ok: false, reason: "expired" });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/magic-link?share=some_share_token&code=some_magic_code",
    );

    const res = await GET(req);
    expect(res.status).toBe(410);
  });
});

describe("Rate limiting on /api/v1/interviews/magic-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: allow everything unless overridden in a specific test.
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 5,
      resetAt: Date.now() + 60_000,
    });
  });

  it("returns 429 with Retry-After header on the 6th request within the window", async () => {
    // First 5 requests succeed; 6th is blocked.
    const baseAllowed = {
      allowed: true as const,
      limit: 5,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    };
    mockCheckRateLimit
      .mockResolvedValueOnce({ ...baseAllowed, remaining: 4 })
      .mockResolvedValueOnce({ ...baseAllowed, remaining: 3 })
      .mockResolvedValueOnce({ ...baseAllowed, remaining: 2 })
      .mockResolvedValueOnce({ ...baseAllowed, remaining: 1 })
      .mockResolvedValueOnce({ ...baseAllowed, remaining: 0 })
      .mockResolvedValueOnce({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      });

    // First 5 share-link lookups must succeed
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink());
    mockCreateMagicLink.mockResolvedValue({
      id: "ml-id",
      blogId: "default",
      shareLinkId: "share-link-123",
      tokenHash: "magic_hashed",
      email: "guest@example.com",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      consumedAt: null,
      createdAt: Date.now(),
    });
    mockSendMagicLinkEmail.mockResolvedValue(undefined);

    const buildReq = () =>
      new NextRequest("http://localhost/api/v1/interviews/magic-link", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.9" },
        body: JSON.stringify({
          shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
          email: "guest@example.com",
        }),
      });

    for (let i = 0; i < 5; i += 1) {
      const res = await POST(buildReq());
      expect(res.status).toBe(200);
    }

    const sixth = await POST(buildReq());
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get("Retry-After")).toBeTruthy();
    expect(sixth.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(sixth.headers.get("X-RateLimit-Remaining")).toBe("0");
    const body = await sixth.json();
    expect(body.error).toBe("Rate limit exceeded");
  });

  it("uses the magic-link rate-limit key and the configured per-minute limit", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink());
    mockCreateMagicLink.mockResolvedValue({
      id: "ml-id",
      blogId: "default",
      shareLinkId: "share-link-123",
      tokenHash: "magic_hashed",
      email: "guest@example.com",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      consumedAt: null,
      createdAt: Date.now(),
    });
    mockSendMagicLinkEmail.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/v1/interviews/magic-link", {
      method: "POST",
      headers: { "x-forwarded-for": "8.8.8.8" },
      body: JSON.stringify({
        shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
        email: "guest@example.com",
      }),
    });

    await POST(req);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "interview-magic-link",
        maxPerMinute: 5,
      }),
    );
  });
});
