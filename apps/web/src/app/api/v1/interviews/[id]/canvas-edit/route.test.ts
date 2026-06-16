import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockAuthError = vi.hoisted(() => class AuthError extends Error {});
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: mockVerifyRequest,
  AuthError: mockAuthError,
}));

// Capture every log line emitted by the route so the test can assert
// that the structured user_edit audit line lands with the contract
// fields (`kind`, `interviewId`, `nodeType`, `position`,
// `contentPreview`, `diffSize`) the LOG_QUERIES queries depend on.
// Partial mock: keep `registerCorrelationIdGetter` (and any other
// exports) wired up so dependent modules don't blow up at import time.
const mockLogInfo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/logger")>();
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: mockLogInfo,
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
});

// Mock worker registry
const mockApplyCanvasEdit = vi.hoisted(() => vi.fn());
const mockGetWorker = vi.hoisted(() => vi.fn(() => ({
  applyCanvasEdit: mockApplyCanvasEdit,
})));

vi.mock("@/lib/interviews/writer-worker-registry", () => ({
  getWorker: mockGetWorker,
}));

// Tenancy role resolution for createApiHandler. Each test sets
// `tenantState.role` to drive the 403 vs success branches.
const tenantState = vi.hoisted(() => ({ role: "owner" as string }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(),
}));

// D1 interview + event repositories.
const mockGetInterview = vi.hoisted(() => vi.fn());
const mockAppendEvents = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
}));

vi.mock("@/lib/interviews/events-repository", () => ({
  appendEvents: mockAppendEvents,
}));

describe("POST /api/v1/interviews/[id]/canvas-edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Authenticated user mock
    mockVerifyRequest.mockResolvedValue({
      uid: "test-user-123",
      email: "test@example.com",
    });

    // Default: write-capable role
    tenantState.role = "admin";

    // Default: Live interview
    mockGetInterview.mockResolvedValue({ status: "live" });
  });

  it("should successfully apply canvas edit and persist event (happy path)", async () => {
    const editPayload = {
      sectionId: "section-1",
      field: "heading",
      value: "New Heading",
    };

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/canvas-edit", {
      method: "Article",
      body: JSON.stringify(editPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockAppendEvents).toHaveBeenCalledWith(
      "default",
      "test-interview-123",
      [
        expect.objectContaining({
          kind: "canvas_edit",
          payload: {
            sectionId: "section-1",
            field: "heading",
            index: undefined,
            value: "New Heading",
          },
        }),
      ],
    );

    expect(mockApplyCanvasEdit).toHaveBeenCalledWith({
      sectionId: "section-1",
      field: "heading",
      value: "New Heading",
    });

    // Structured audit log lands with the fields LOG_QUERIES.md depends on.
    expect(mockLogInfo).toHaveBeenCalledWith(
      "user_edit dispatched",
      expect.objectContaining({
        kind: "user_edit",
        interviewId: "test-interview-123",
        nodeType: "heading",
        position: null,
        contentPreview: "New Heading",
        diffSize: 11,
      }),
    );
  });

  it("truncates contentPreview to 200 chars in the structured user_edit log", async () => {
    const longValue = "x".repeat(500);
    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/canvas-edit", {
      method: "Article",
      body: JSON.stringify({
        sectionId: "section-1",
        field: "heading",
        value: longValue,
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    expect(mockLogInfo).toHaveBeenCalledWith(
      "user_edit dispatched",
      expect.objectContaining({
        diffSize: 500,
        contentPreview: "x".repeat(200),
      }),
    );
  });

  it("should reject with 403 if user has non-admin/editor/owner role", async () => {
    tenantState.role = "viewer";

    const editPayload = {
      sectionId: "section-1",
      field: "heading",
      value: "New Heading",
    };

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/canvas-edit", {
      method: "Article",
      body: JSON.stringify(editPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("should return 404 if interview is not found", async () => {
    mockGetInterview.mockResolvedValue(null);

    const editPayload = {
      sectionId: "section-1",
      field: "heading",
      value: "New Heading",
    };

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/canvas-edit", {
      method: "Article",
      body: JSON.stringify(editPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Interview not found");
  });

  it("should return 409 if interview is not live", async () => {
    mockGetInterview.mockResolvedValue({ status: "ended" });

    const editPayload = {
      sectionId: "section-1",
      field: "heading",
      value: "New Heading",
    };

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/canvas-edit", {
      method: "Article",
      body: JSON.stringify(editPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Cannot edit canvas for interview that is not live");
  });

  it("should return 400 if validation fails (missing index for paragraph_text)", async () => {
    const editPayload = {
      sectionId: "section-1",
      field: "paragraph_text",
      value: "New Paragraph Content",
    };

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/canvas-edit", {
      method: "Article",
      body: JSON.stringify(editPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(400);
  });

  it("should enforce rate limiting of 30 edits per minute", async () => {
    const editPayload = {
      sectionId: "section-1",
      field: "heading",
      value: "New Heading",
    };

    // Make 30 requests - should all succeed
    for (let i = 0; i < 30; i++) {
      const req = new NextRequest(`http://localhost/api/v1/interviews/rate-limit-test/canvas-edit`, {
        method: "Article",
        body: JSON.stringify(editPayload),
      });
      const res = await POST(req, { params: Promise.resolve({ id: "rate-limit-test" }) });
      expect(res.status).toBe(200);
    }

    // 31st request should be rate limited (429)
    const req = new NextRequest(`http://localhost/api/v1/interviews/rate-limit-test/canvas-edit`, {
      method: "Article",
      body: JSON.stringify(editPayload),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "rate-limit-test" }) });
    expect(res.status).toBe(429);
  });

  it("rejects canvas-edit values above the 8 KB size cap to prevent DoS fan-out", async () => {
    const oversizedValue = "x".repeat(8_001);
    const editPayload = {
      sectionId: "section-1",
      field: "heading",
      value: oversizedValue,
    };

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/canvas-edit", {
      method: "Article",
      body: JSON.stringify(editPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(400);
    // The event must not be persisted nor fanned out to the worker.
    expect(mockAppendEvents).not.toHaveBeenCalled();
    expect(mockApplyCanvasEdit).not.toHaveBeenCalled();
  });

  it("rejects canvas-edit sectionId above the 64-char cap", async () => {
    const editPayload = {
      sectionId: "s".repeat(65),
      field: "heading",
      value: "ok",
    };

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/canvas-edit", {
      method: "Article",
      body: JSON.stringify(editPayload),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(400);
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });
});
