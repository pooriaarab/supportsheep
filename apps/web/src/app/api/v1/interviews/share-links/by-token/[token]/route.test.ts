import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());

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

// D1 repo mock
const mockGetShareLinkByTokenHash = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLinkByTokenHash: mockGetShareLinkByTokenHash,
}));

function makeShareLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "link-1",
    blogId: "default",
    type: "link",
    createdBy: "user-creator-123",
    workspaceId: "default",
    topic: "Test Topic",
    goal: "Test Goal",
    style: "smart",
    authMode: "anonymous",
    recordingConfig: "transcript",
    maxDurationSec: 300,
    expiresAt: null,
    maxUses: null,
    uses: 0,
    status: "active",
    tokenHash: "hash",
    language: "en",
    scheduledAt: null,
    scheduledGuestEmail: null,
    mode: "live",
    asyncQuestions: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("GET /api/v1/interviews/share-links/by-token/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("should return 404 if token length is less than 32", async () => {
    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/by-token/short");
    const res = await GET(req, { params: Promise.resolve({ token: "short" }) } as never);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "not_found" });
  });

  it("should return 404 if share link is not found", async () => {
    mockGetShareLinkByTokenHash.mockResolvedValue(null);

    const longToken = "a".repeat(43); // valid base64url 32-byte token length
    const req = new NextRequest(`http://localhost/api/v1/interviews/share-links/by-token/${longToken}`);
    const res = await GET(req, { params: Promise.resolve({ token: longToken }) } as never);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "not_found" });
  });

  it("should return 200 with the public safe view for an active, valid token", async () => {
    const longToken = "token_abc123_xyz456_7890_extremely_long_token_here";
    const expectedHash = hashShareLinkToken(longToken);

    mockGetShareLinkByTokenHash.mockResolvedValue(
      makeShareLink({
        tokenHash: expectedHash,
        scheduledAt: "2026-06-01T10:00:00.000Z",
      }),
    );

    const req = new NextRequest(`http://localhost/api/v1/interviews/share-links/by-token/${longToken}`);
    const res = await GET(req, { params: Promise.resolve({ token: longToken }) } as never);

    expect(res.status).toBe(200);
    const json = await res.json();

    // Verify projected view has correct fields
    expect(json).toEqual({
      topic: "Test Topic",
      goal: "Test Goal",
      style: "smart",
      recordingConfig: "transcript",
      maxDurationSec: 300,
      authMode: "anonymous",
      type: "link",
      status: "active",
      language: "en",
      scheduledAt: "2026-06-01T10:00:00.000Z",
      mode: "live",
    });

    // Verification check: No private keys leaked!
    expect(json.id).toBeUndefined();
    expect(json.createdBy).toBeUndefined();
    expect(json.workspaceId).toBeUndefined();
    expect(json.tokenHash).toBeUndefined();
    expect(json.uses).toBeUndefined();
    expect(json.maxUses).toBeUndefined();
  });

  it("should return 404 (and NOT 410 or 403) if the share link is revoked", async () => {
    const longToken = "token_abc123_xyz456_7890_extremely_long_token_here";
    mockGetShareLinkByTokenHash.mockResolvedValue(makeShareLink({ status: "revoked" }));

    const req = new NextRequest(`http://localhost/api/v1/interviews/share-links/by-token/${longToken}`);
    const res = await GET(req, { params: Promise.resolve({ token: longToken }) } as never);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "not_found" });
  });

  it("should return 404 if the share link is expired", async () => {
    const longToken = "token_abc123_xyz456_7890_extremely_long_token_here";
    mockGetShareLinkByTokenHash.mockResolvedValue(
      makeShareLink({ expiresAt: "2026-05-18T12:00:00.000Z" }),
    );

    const req = new NextRequest(`http://localhost/api/v1/interviews/share-links/by-token/${longToken}`);
    const res = await GET(req, { params: Promise.resolve({ token: longToken }) } as never);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "not_found" });
  });

  it("should return 404 if uses have exceeded maxUses", async () => {
    const longToken = "token_abc123_xyz456_7890_extremely_long_token_here";
    mockGetShareLinkByTokenHash.mockResolvedValue(
      makeShareLink({ maxUses: 5, uses: 5 }),
    );

    const req = new NextRequest(`http://localhost/api/v1/interviews/share-links/by-token/${longToken}`);
    const res = await GET(req, { params: Promise.resolve({ token: longToken }) } as never);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "not_found" });
  });
});
