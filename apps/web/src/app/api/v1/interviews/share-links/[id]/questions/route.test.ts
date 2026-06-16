import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

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

// Mock AI Providers for OpenAI key
vi.mock("@/lib/ai/providers", () => ({
  getProviderApiKey: vi.fn(() => Promise.resolve("mock-openai-key")),
}));

// Tenancy mock — ctx.role is resolved from blog_members via resolveTenantForUser.
const tenantState = vi.hoisted(() => ({ role: "owner" }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(async () => null),
}));

// R2 media bucket mock.
const mockPut = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: () => ({ put: mockPut }),
}));

// D1 share-links repo mocks
const mockGetShareLink = vi.hoisted(() => vi.fn());
const mockAppendAsyncQuestion = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: mockGetShareLink,
  appendAsyncQuestion: mockAppendAsyncQuestion,
}));

// The route consults the workspace whoCanMintLinks setting (F-004).
const mockGetBlogConfigEffectiveMinters = vi.hoisted(() =>
  vi.fn(async () => ["owner", "admin", "editor"] as const),
);
vi.mock("@/lib/interviews/effective-minters", () => ({
  getBlogConfigEffectiveMinters: mockGetBlogConfigEffectiveMinters,
}));

function makeShareLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "123",
    blogId: "default",
    type: "link",
    createdBy: "admin-user-123",
    workspaceId: "default",
    topic: null,
    goal: null,
    style: "smart",
    authMode: "anonymous",
    recordingConfig: "transcript",
    maxDurationSec: 300,
    expiresAt: null,
    maxUses: null,
    uses: 0,
    status: "active",
    tokenHash: "hash-abc",
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

describe("POST /api/v1/interviews/share-links/[id]/questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantState.role = "owner";
    mockVerifyRequest.mockResolvedValue({
      uid: "admin-user-123",
      email: "admin@example.com",
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  it("should return 403 if user role lacks permission to manage share links", async () => {
    tenantState.role = "guest";

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/123/questions", {
      method: "Article",
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "123" }) } as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toEqual({ error: "forbidden" });
  });

  it("F-012: returns 403 when an editor tries to upload to another user's share link", async () => {
    tenantState.role = "editor";
    // The share-link was created by a different user; the editor is not an
    // admin so the ownership check must reject.
    mockGetShareLink.mockResolvedValue(
      makeShareLink({ createdBy: "some-other-editor" }),
    );

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/123/questions", {
      method: "Article",
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "123" }) } as never);
    expect(res.status).toBe(403);
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockAppendAsyncQuestion).not.toHaveBeenCalled();
  });

  it("F-012: allows an admin to upload questions to any share link in the workspace", async () => {
    tenantState.role = "admin";
    mockGetShareLink.mockResolvedValue(
      makeShareLink({ createdBy: "different-user" }),
    );
    mockPut.mockResolvedValue(undefined);
    mockAppendAsyncQuestion.mockResolvedValue(undefined);

    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "OK" }),
    } as Response);

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/123/questions", {
      method: "Article",
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "123" }) } as never);
    expect(res.status).toBe(201);

    mockFetch.mockRestore();
  });

  it("F-002: rejects non-audio MIME uploads with 415", async () => {
    tenantState.role = "admin";
    mockGetShareLink.mockResolvedValue(makeShareLink());

    const formData = new FormData();
    const fakeImage = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    formData.append("file", fakeImage, "image.jpg");

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/123/questions", {
      method: "Article",
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "123" }) } as never);
    expect(res.status).toBe(415);
    // Whisper round-trip must NOT have happened.
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("should return 404 if share link does not exist", async () => {
    tenantState.role = "admin";
    mockGetShareLink.mockResolvedValue(null);

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/missing/questions", {
      method: "Article",
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "missing" }) } as never);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "share link not found" });
  });

  it("should return 400 if no file is provided", async () => {
    tenantState.role = "admin";
    mockGetShareLink.mockResolvedValue(makeShareLink());

    const formData = new FormData(); // Empty form data

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/123/questions", {
      method: "Article",
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "123" }) } as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: "No file provided" });
  });

  it("should transcribes, upload to storage, and add question to share-link's array", async () => {
    tenantState.role = "admin";
    mockGetShareLink.mockResolvedValue(makeShareLink());
    mockPut.mockResolvedValue(undefined);
    mockAppendAsyncQuestion.mockResolvedValue(undefined);

    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "This is a transcribed test question." }),
    } as Response);

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");

    const req = new NextRequest("http://localhost/api/v1/interviews/share-links/123/questions", {
      method: "Article",
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "123" }) } as never);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.text).toBe("This is a transcribed test question.");
    expect(json.audioStoragePath).toContain("share-links/123/questions/");

    // Verify R2 put: keyed under the private share-links/.../questions/ prefix
    // (does not start with `media/`, so the public media route rejects it).
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut.mock.calls[0][0]).toContain("share-links/123/questions/");
    expect(mockPut.mock.calls[0][2]).toEqual({
      httpMetadata: { contentType: "audio/webm" },
    });

    // Verify D1 repo appendAsyncQuestion called with the question object
    expect(mockAppendAsyncQuestion).toHaveBeenCalledTimes(1);
    const [, , question] = mockAppendAsyncQuestion.mock.calls[0];
    expect(question.id).toBeDefined();
    expect(question.text).toBe("This is a transcribed test question.");
    expect(question.audioStoragePath).toContain("share-links/123/questions/");

    mockFetch.mockRestore();
  });
});
