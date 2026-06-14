import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";

const mockGetInterview = vi.hoisted(() => vi.fn());
const mockGetShareLink = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
}));

vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: mockGetShareLink,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(),
}));

// create-api-handler imports AuthError from session
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

const VALID_TOKEN = "a".repeat(43); // 32-byte b64url is ~43 chars
const VALID_TOKEN_HASH = hashShareLinkToken(VALID_TOKEN);

function makeInterview(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-id-123",
    blogId: "default",
    status: "consent",
    startedByUid: null,
    startedByRole: null,
    shareLinkId: null,
    guestEmail: null,
    guestName: null,
    style: "smart",
    topic: null,
    goal: null,
    recordingConfig: "transcript",
    language: "en",
    mode: "live",
    maxDurationSec: 300,
    canvasSnapshot: null,
    canvasSnapshotAt: null,
    articleId: null,
    publishedDirect: null,
    requiresReview: null,
    endedAt: null,
    startedAt: null,
    responsesCount: 0,
    videoProvider: null,
    tavusConversationId: null,
    costUsd: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("GET /api/v1/interviews/[id]/public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return public projection when shareLinkToken matches the interview's share link", async () => {
    mockGetInterview.mockResolvedValue(
      makeInterview({
        shareLinkId: "share-link-123",
        guestName: "Secret Guest",
        guestEmail: "guest@example.com",
        style: "case_study",
        recordingConfig: "audio",
        maxDurationSec: 450,
        topic: "My Public Topic",
        goal: "My Public Goal",
      }),
    );
    mockGetShareLink.mockResolvedValue({
      id: "share-link-123",
      blogId: "default",
      tokenHash: VALID_TOKEN_HASH,
      status: "active",
      type: "link",
      createdBy: "user-1",
      workspaceId: "default",
      style: "case_study",
      authMode: "anonymous",
      recordingConfig: "audio",
      maxDurationSec: 450,
      topic: "My Public Topic",
      goal: "My Public Goal",
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
    });

    const req = new NextRequest(
      `http://localhost/api/v1/interviews/test-id-123/public?shareLinkToken=${VALID_TOKEN}`,
    );
    const res = await GET(req, { params: Promise.resolve({ id: "test-id-123" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      id: "test-id-123",
      status: "consent",
      recordingConfig: "audio",
      maxDurationSec: 450,
      topic: "My Public Topic",
    });

    // No PII leak
    expect(json.guestName).toBeUndefined();
    expect(json.guestEmail).toBeUndefined();
    expect(json.blogId).toBeUndefined();
    expect(json.shareLinkId).toBeUndefined();
    expect(json.createdAt).toBeUndefined();
    expect(json.goal).toBeUndefined();
    expect(json.style).toBeUndefined();
  });

  it("should return 404 when shareLinkToken query param is missing", async () => {
    const req = new NextRequest("http://localhost/api/v1/interviews/test-id-123/public");
    const res = await GET(req, { params: Promise.resolve({ id: "test-id-123" }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(mockGetInterview).not.toHaveBeenCalled();
  });

  it("should return 404 when the shareLinkToken does not match the interview's share link", async () => {
    mockGetInterview.mockResolvedValue(
      makeInterview({
        shareLinkId: "share-link-123",
        recordingConfig: "transcript",
        maxDurationSec: 300,
      }),
    );
    mockGetShareLink.mockResolvedValue({
      id: "share-link-123",
      blogId: "default",
      tokenHash: "different-hash",
      status: "active",
    });

    const req = new NextRequest(
      `http://localhost/api/v1/interviews/test-id-123/public?shareLinkToken=${VALID_TOKEN}`,
    );
    const res = await GET(req, { params: Promise.resolve({ id: "test-id-123" }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("should return 404 when the interview has no shareLinkId (self flow)", async () => {
    mockGetInterview.mockResolvedValue(
      makeInterview({
        startedByUid: "user-123",
        recordingConfig: "transcript",
        maxDurationSec: 300,
      }),
    );

    const req = new NextRequest(
      `http://localhost/api/v1/interviews/test-id-123/public?shareLinkToken=${VALID_TOKEN}`,
    );
    const res = await GET(req, { params: Promise.resolve({ id: "test-id-123" }) });

    expect(res.status).toBe(404);
  });

  it("should return 404 if the interview is not found", async () => {
    mockGetInterview.mockResolvedValue(null);

    const req = new NextRequest(
      `http://localhost/api/v1/interviews/test-id-123/public?shareLinkToken=${VALID_TOKEN}`,
    );
    const res = await GET(req, { params: Promise.resolve({ id: "test-id-123" }) });

    expect(res.status).toBe(404);
  });

  it("should return 404 if the referenced share link doesn't exist", async () => {
    mockGetInterview.mockResolvedValue(
      makeInterview({
        shareLinkId: "missing-share-link",
        recordingConfig: "transcript",
        maxDurationSec: 300,
      }),
    );
    mockGetShareLink.mockResolvedValue(null);

    const req = new NextRequest(
      `http://localhost/api/v1/interviews/test-id-123/public?shareLinkToken=${VALID_TOKEN}`,
    );
    const res = await GET(req, { params: Promise.resolve({ id: "test-id-123" }) });

    expect(res.status).toBe(404);
  });
});
