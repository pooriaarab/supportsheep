import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());

// Mock Auth verify
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

// D1 share-links repository mock.
const mockGetByTokenHash = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLinkByTokenHash: mockGetByTokenHash,
}));

describe("GET /api/v1/interviews/share-links/by-token/[token]/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("should return 404 if token length is less than 32", async () => {
    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/by-token/short/calendar");
    const res = await GET(req, { params: Promise.resolve({ token: "short" }) } as never);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "not_found" });
  });

  it("should return 404 if share link is not found", async () => {
    mockGetByTokenHash.mockResolvedValue(null);

    const longToken = "a".repeat(43);
    const req = new NextRequest(`http://localhost/api/v1/interviews/share-links/by-token/${longToken}/calendar`);
    const res = await GET(req, { params: Promise.resolve({ token: longToken }) } as never);

    expect(res.status).toBe(404);
  });

  it("should return 404 if share link is not scheduled", async () => {
    const longToken = "token_abc123_xyz456_7890_extremely_long_token_here";
    const expectedHash = hashShareLinkToken(longToken);

    mockGetByTokenHash.mockResolvedValue({
      id: "link-1",
      type: "link",
      createdBy: "user-creator-123",
      workspaceId: "default",
      topic: "Test Topic",
      style: "smart",
      authMode: "anonymous",
      recordingConfig: "transcript",
      maxDurationSec: 300,
      expiresAt: null,
      maxUses: null,
      uses: 0,
      status: "active",
      tokenHash: expectedHash,
      scheduledAt: null, // not scheduled
    });

    const req = new NextRequest(`http://localhost/api/v1/interviews/share-links/by-token/${longToken}/calendar`);
    const res = await GET(req, { params: Promise.resolve({ token: longToken }) } as never);

    expect(res.status).toBe(404);
  });

  it("should return 200 with the ICS calendar data if active and scheduled", async () => {
    const longToken = "token_abc123_xyz456_7890_extremely_long_token_here";
    const expectedHash = hashShareLinkToken(longToken);

    mockGetByTokenHash.mockResolvedValue({
      id: "link-1",
      type: "link",
      createdBy: "user-creator-123",
      workspaceId: "default",
      topic: "Test Topic",
      style: "smart",
      authMode: "anonymous",
      recordingConfig: "transcript",
      maxDurationSec: 300,
      expiresAt: null,
      maxUses: null,
      uses: 0,
      status: "active",
      tokenHash: expectedHash,
      scheduledAt: "2026-06-01T10:00:00.000Z",
    });

    const req = new NextRequest(`http://localhost/api/v1/interviews/share-links/by-token/${longToken}/calendar`);
    const res = await GET(req, { params: Promise.resolve({ token: longToken }) } as never);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("DTSTART:20260601T100000Z");
  });
});
