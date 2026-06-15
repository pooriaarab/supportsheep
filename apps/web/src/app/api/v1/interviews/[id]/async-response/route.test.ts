import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockVerifyInterviewToken = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());

// Mock Auth
vi.mock("@/lib/auth/session", () => ({
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
  verifyRequest: vi.fn(),
}));

vi.mock("@/lib/interviews/interview-token", () => ({
  verifyInterviewToken: mockVerifyInterviewToken,
  getInterviewTokenCookieName: (id: string) => `interview_token_${id}`,
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

// Mock D1 interviews repository
const mockGetInterview = vi.hoisted(() => vi.fn());
const mockIncrementResponsesCount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
  incrementResponsesCount: mockIncrementResponsesCount,
}));

// Mock D1 async-responses repository
const mockUpsertAsyncResponse = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/async-responses-repository", () => ({
  upsertAsyncResponse: mockUpsertAsyncResponse,
}));

// Mock tenancy repository (create-api-handler calls resolveTenantForUser)
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn().mockResolvedValue({ blogId: "default" }),
}));

// R2 media bucket mock.
const mockPut = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: () => ({ put: mockPut }),
}));

describe("POST /api/v1/interviews/[id]/async-response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockIncrementResponsesCount.mockResolvedValue(undefined);
    mockUpsertAsyncResponse.mockResolvedValue({
      id: "resp-1",
      blogId: "default",
      interviewId: "int-123",
      questionId: "q-123",
      audioStoragePath: "interviews/int-123/responses/q-123.webm",
      transcript: "test",
      createdAt: Date.now(),
    });
  });

  it("should return 401 if authorization header is missing", async () => {
    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");
    formData.append("questionId", "q-123");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Missing interview token");
  });

  it("should return 401 if token verification fails", async () => {
    mockVerifyInterviewToken.mockReturnValue(null);

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");
    formData.append("questionId", "q-123");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: {
        Authorization: "Bearer invalid-token",
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("should return 403 if interviewId in token does not match params ID", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-456",
      iat: 1234567,
      exp: 1234567 + 1800,
    });

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");
    formData.append("questionId", "q-123");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("should return 404 if interview does not exist", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-123",
      iat: 1234567,
      exp: 1234567 + 1800,
    });
    mockGetInterview.mockResolvedValue(null);

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");
    formData.append("questionId", "q-123");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Interview not found");
  });

  it("should return 400 if file is missing", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-123",
      iat: 1234567,
      exp: 1234567 + 1800,
    });
    mockGetInterview.mockResolvedValue({
      id: "int-123",
      blogId: "default",
      status: "live",
      mode: "async",
      language: "en",
    });

    const formData = new FormData();
    formData.append("questionId", "q-123");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No file provided");
  });

  it("should return 400 if questionId is missing", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-123",
      iat: 1234567,
      exp: 1234567 + 1800,
    });
    mockGetInterview.mockResolvedValue({
      id: "int-123",
      blogId: "default",
      status: "live",
      mode: "async",
      language: "en",
    });

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid or missing questionId");
  });

  it("should transcribe audio, save to storage, upsert to D1, and increment responsesCount", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-123",
      iat: 1234567,
      exp: 1234567 + 1800,
    });
    mockGetInterview.mockResolvedValue({
      id: "int-123",
      blogId: "default",
      status: "live",
      mode: "async",
      language: "en",
    });
    mockPut.mockResolvedValue(undefined);

    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "This is my guest voice response." }),
    } as Response);

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");
    formData.append("questionId", "q-123");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.transcript).toBe("This is my guest voice response.");
    expect(json.audioStoragePath).toBe("interviews/int-123/responses/q-123.webm");

    // Verify R2 put: keyed under the private interviews/.../responses/ prefix
    // (does not start with `media/`, so the public media route rejects it).
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut.mock.calls[0][0]).toBe("interviews/int-123/responses/q-123.webm");
    expect(mockPut.mock.calls[0][2]).toEqual({
      httpMetadata: { contentType: "audio/webm" },
    });

    // Verify D1 upsert with correct args
    expect(mockUpsertAsyncResponse).toHaveBeenCalledWith(
      "default",
      "int-123",
      {
        questionId: "q-123",
        audioStoragePath: "interviews/int-123/responses/q-123.webm",
        transcript: "This is my guest voice response.",
      },
    );

    // Verify responsesCount increment
    expect(mockIncrementResponsesCount).toHaveBeenCalledWith("default", "int-123");

    mockFetch.mockRestore();
  });

  it("F-002: rejects an image masquerading as audio with 415 before invoking Whisper", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-123",
      iat: 1234567,
      exp: 1234567 + 1800,
    });
    mockGetInterview.mockResolvedValue({
      id: "int-123",
      blogId: "default",
      status: "live",
      mode: "async",
      language: "en",
    });

    const mockFetch = vi.spyOn(global, "fetch");

    const formData = new FormData();
    const jpegBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    formData.append("file", jpegBlob, "image.jpg");
    formData.append("questionId", "q-123");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: { Authorization: "Bearer valid-token" },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(415);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockUpsertAsyncResponse).not.toHaveBeenCalled();

    mockFetch.mockRestore();
  });

  it("F-002: rejects Content-Length above the cap with 413", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-123",
      iat: 1234567,
      exp: 1234567 + 1800,
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
        "content-length": String(50 * 1024 * 1024), // 50 MB
      },
      body: new FormData(),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(413);
  });

  it("should return 400 if interview is not in async mode", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "int-123",
      iat: 1234567,
      exp: 1234567 + 1800,
    });
    mockGetInterview.mockResolvedValue({
      id: "int-123",
      blogId: "default",
      status: "live",
      mode: "live",
      language: "en",
    });

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    formData.append("file", audioBlob, "audio.webm");
    formData.append("questionId", "q-123");

    const req = new NextRequest("http://localhost/api/v1/interviews/int-123/async-response", {
      method: "Article",
      headers: { Authorization: "Bearer valid-token" },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "int-123" }) } as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Interview is not in async mode");
  });
});
