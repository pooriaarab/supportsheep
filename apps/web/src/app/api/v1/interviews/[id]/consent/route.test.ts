import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { TavusMintError } from "@/lib/interviews/tavus";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());
const mockMintTavusSession = vi.hoisted(() => vi.fn());
const mockGetProviderApiKey = vi.hoisted(() => vi.fn());

// Mock Tavus. Real TavusMintError is preserved so the route's
// `err instanceof TavusMintError` branch is exercised faithfully.
vi.mock("@/lib/interviews/tavus", async () => {
  const actual = await vi.importActual<typeof import("@/lib/interviews/tavus")>(
    "@/lib/interviews/tavus",
  );
  return {
    mintTavusSession: mockMintTavusSession,
    TavusMintError: actual.TavusMintError,
  };
});

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

// Mock AI providers — keys live in Firestore, not env.
vi.mock("@/lib/ai/providers", () => ({
  getProviderApiKey: mockGetProviderApiKey,
}));

// D1 repo mocks
const mockGetInterview = vi.hoisted(() => vi.fn());
const mockConsentToLive = vi.hoisted(() => vi.fn());
const mockUpdateInterview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
  consentToLive: mockConsentToLive,
  updateInterview: mockUpdateInterview,
}));

const mockGetShareLink = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: mockGetShareLink,
}));

const mockGetBlogConfig = vi.hoisted(() => vi.fn());
vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mockGetBlogConfig,
  resolveBlogConfig: (val: unknown) => val,
}));

// Firebase mock (not used in consent route directly, but create-api-handler may import it)
vi.mock("@/lib/db/firebase-admin", () => ({
  collections: {
    users: () => ({ doc: vi.fn(() => ({ get: vi.fn() })) }),
    interviews: () => ({ doc: vi.fn() }),
    shareLinks: () => ({ doc: vi.fn() }),
  },
  getAdminDb: vi.fn(() => ({ runTransaction: vi.fn() })),
  FieldValue: { serverTimestamp: vi.fn(() => "ts") },
}));

function makeInterview(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-interview-id",
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

describe("POST /api/v1/interviews/[id]/consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockGetProviderApiKey.mockResolvedValue("test-sk-key");
    mockConsentToLive.mockResolvedValue({ ok: true });
    mockUpdateInterview.mockResolvedValue(null);
    // Default: no cap configured so blog config doesn't gate flow.
    mockGetBlogConfig.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should support consent & minting for self-flow", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-123",
      email: "user@example.com",
    });

    mockGetInterview.mockResolvedValue(
      makeInterview({
        startedByUid: "user-123",
        style: "smart",
        topic: "Tech",
        goal: "Insights",
      }),
    );

    const mockOpenAIResponse = {
      client_secret: {
        value: "sess_mock_123",
        expires_at: 999999999,
      },
      id: "realtime_session_abc",
    };

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => "req_mock" },
      json: async () => mockOpenAIResponse,
    } as unknown as Response);

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
      method: "POST",
      body: JSON.stringify({
        confirmed: true,
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-id" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.client_secret).toEqual(mockOpenAIResponse.client_secret);
    expect(json.interviewToken).toBeTruthy();
    expect(json.interviewId).toBe("test-interview-id");

    // F-006: consent must set the interview-token HttpOnly cookie.
    const setCookieHeader = res.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toContain("interview_token_test-interview-id=");
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toContain("SameSite=lax");
    expect(setCookieHeader).toContain("Path=/api/v1/interviews/test-interview-id");

    expect(mockConsentToLive).toHaveBeenCalledWith(
      "default",
      "test-interview-id",
      null,
    );
  });

  it("should support consent for async pre-recorded mode and NOT mint OpenAI/Tavus sessions", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-123",
      email: "user@example.com",
    });

    mockGetInterview.mockResolvedValue(
      makeInterview({
        startedByUid: "user-123",
        style: "smart",
        topic: "Tech",
        goal: "Insights",
        mode: "async",
      }),
    );

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
      method: "POST",
      body: JSON.stringify({
        confirmed: true,
      }),
    });

    const spyFetch = vi.spyOn(global, "fetch");

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-id" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.interviewToken).toBeTruthy();
    expect(json.interviewId).toBe("test-interview-id");
    expect(json.client_secret).toBeUndefined(); // No OpenAI secret

    expect(mockConsentToLive).toHaveBeenCalled();
    expect(spyFetch).not.toHaveBeenCalled();
    expect(mockMintTavusSession).not.toHaveBeenCalled();
  });

  it("returns a mock-prefixed client_secret when LLM_PROVIDER=mock and never calls OpenAI", async () => {
    const originalProvider = process.env.LLM_PROVIDER;
    const originalTimeline = process.env.INTERVIEW_MOCK_TIMELINE;
    process.env.LLM_PROVIDER = "mock";
    process.env.INTERVIEW_MOCK_TIMELINE = "comprehensive";
    try {
      mockVerifyRequest.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });

      mockGetInterview.mockResolvedValue(
        makeInterview({
          startedByUid: "user-123",
          style: "smart",
          topic: "Tech",
          goal: "Insights",
        }),
      );

      const spyFetch = vi.spyOn(global, "fetch");

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-mock-id/consent",
        {
          method: "POST",
          body: JSON.stringify({ confirmed: true }),
        },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-mock-id" }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.mock).toBe(true);
      expect(json.client_secret.value).toBe("mock-test-mock-id:comprehensive");
      expect(json.interviewToken).toBeTruthy();
      expect(json.interviewId).toBe("test-mock-id");
      expect(spyFetch).not.toHaveBeenCalled();
    } finally {
      if (originalProvider === undefined) {
        delete process.env.LLM_PROVIDER;
      } else {
        process.env.LLM_PROVIDER = originalProvider;
      }
      if (originalTimeline === undefined) {
        delete process.env.INTERVIEW_MOCK_TIMELINE;
      } else {
        process.env.INTERVIEW_MOCK_TIMELINE = originalTimeline;
      }
    }
  });

  it("should pass the language field from the interview to mintRealtimeSession", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-123",
      email: "user@example.com",
    });

    mockGetInterview.mockResolvedValue(
      makeInterview({
        startedByUid: "user-123",
        style: "smart",
        topic: "Tech",
        goal: "Insights",
        language: "fr",
      }),
    );

    const mockOpenAIResponse = {
      client_secret: {
        value: "sess_mock_789",
        expires_at: 999999999,
      },
      id: "realtime_session_abc",
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => "req_mock" },
      json: async () => mockOpenAIResponse,
    } as unknown as Response);

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
      method: "POST",
      body: JSON.stringify({
        confirmed: true,
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-id" }) });
    expect(res.status).toBe(200);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/client_secrets",
      expect.objectContaining({
        body: expect.stringContaining(
          '"transcription":{"model":"whisper-1","language":"fr"}',
        ),
      }),
    );
    // W15.1 fix: ephemeral mint MUST send server_vad turn_detection.
    const [, openaiInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const openaiBody = JSON.parse(openaiInit.body as string);
    expect(openaiBody.session.audio.input.turn_detection).toEqual({
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 800,
      create_response: true,
      interrupt_response: true,
    });
  });

  it("should support consent & minting for share-link flow", async () => {
    const mockInterviewData = makeInterview({
      shareLinkId: "share-link-123",
      style: "eeat",
      topic: "SEO",
      goal: "EEAT Explainer",
    });

    const mockShareLinkData = {
      id: "share-link-123",
      blogId: "default",
      status: "active",
      tokenHash: hashShareLinkToken("this-is-a-valid-token-at-least-32-chars-long"),
      type: "link",
      createdBy: "user-1",
      workspaceId: "default",
      style: "eeat",
      authMode: "anonymous",
      recordingConfig: "transcript",
      maxDurationSec: 300,
      topic: "SEO",
      goal: "EEAT Explainer",
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
    };

    mockGetInterview.mockResolvedValue(mockInterviewData);
    mockGetShareLink.mockResolvedValue(mockShareLinkData);

    const mockOpenAIResponse = {
      client_secret: {
        value: "sess_mock_456",
        expires_at: 999999999,
      },
      id: "realtime_session_abc",
    };

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => "req_mock" },
      json: async () => mockOpenAIResponse,
    } as unknown as Response);

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
      method: "POST",
      body: JSON.stringify({
        confirmed: true,
        shareLinkToken: "this-is-a-valid-token-at-least-32-chars-long",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-id" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.client_secret).toEqual(mockOpenAIResponse.client_secret);
    expect(json.interviewToken).toBeTruthy();
  });

  it("should return 409 if interview is not in consent status", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-123",
      email: "user@example.com",
    });

    mockGetInterview.mockResolvedValue(
      makeInterview({ startedByUid: "user-123", status: "live" }),
    );
    // consentToLive would return conflict since status is live
    mockConsentToLive.mockResolvedValue({ ok: false, reason: "conflict" });

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
      method: "POST",
      body: JSON.stringify({ confirmed: true }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-id" }) });
    expect(res.status).toBe(409);
  });

  it("should return 403 if self-flow authorization fails", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-different",
      email: "different@example.com",
    });

    mockGetInterview.mockResolvedValue(
      makeInterview({ startedByUid: "user-123" }),
    );

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
      method: "POST",
      body: JSON.stringify({ confirmed: true }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-id" }) });
    expect(res.status).toBe(403);
  });

  it("should return 502 if OpenAI session minting fails", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-123",
      email: "user@example.com",
    });

    mockGetInterview.mockResolvedValue(
      makeInterview({
        startedByUid: "user-123",
        style: "smart",
      }),
    );

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: async () => "Upstream model error",
    } as unknown as Response);

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
      method: "POST",
      body: JSON.stringify({ confirmed: true }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-id" }) });
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("Failed to initialize interview stream");
  });

  it("should reject consent with 429 if monthly cost cap has been reached or exceeded", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-123",
      email: "user@example.com",
    });

    mockGetInterview.mockResolvedValue(
      makeInterview({ startedByUid: "user-123", style: "smart" }),
    );

    // Mock cost cap of $10
    mockGetBlogConfig.mockResolvedValue({
      interview: { monthlyCostCapUsd: 10 },
    });

    // consentToLive returns cost_cap_exceeded when cap is exceeded
    mockConsentToLive.mockResolvedValue({ ok: false, reason: "cost_cap_exceeded" });

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
      method: "POST",
      body: JSON.stringify({ confirmed: true }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-id" }) });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Monthly cost cap exceeded for this workspace.");
  });

  it(
    "should atomically reject the second concurrent guest when the cap is at threshold",
    async () => {
      // The atomicity is now handled by consentToLive (conditional UPDATE).
      // We simulate: first call succeeds, second call returns cost_cap_exceeded.
      mockVerifyRequest.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });

      mockGetInterview.mockResolvedValue(
        makeInterview({ startedByUid: "user-123", style: "smart" }),
      );

      mockGetBlogConfig.mockResolvedValue({
        interview: { monthlyCostCapUsd: 10 },
      });

      let callCount = 0;
      mockConsentToLive.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { ok: true };
        return { ok: false, reason: "cost_cap_exceeded" };
      });

      // Allow the first request to complete its OpenAI mint without erroring.
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        headers: { get: () => "req_mock" },
        json: async () => ({
          client_secret: { value: "sess_mock_race", expires_at: 999999999 },
          id: "realtime_session_race",
        }),
      } as unknown as Response);

      const makeReq = () =>
        new NextRequest("http://localhost/api/v1/interviews/test-interview-id/consent", {
          method: "POST",
          body: JSON.stringify({ confirmed: true }),
        });

      const first = await POST(makeReq(), {
        params: Promise.resolve({ id: "test-interview-id" }),
      });
      const second = await POST(makeReq(), {
        params: Promise.resolve({ id: "test-interview-id" }),
      });

      // First request succeeds
      expect(first.status).toBe(200);
      // Second request is rejected with 429
      expect(second.status).toBe(429);
      const secondJson = await second.json();
      expect(secondJson.error).toBe("Monthly cost cap exceeded for this workspace.");
    },
  );

  describe("Tavus video session error surface", () => {
    function buildVideoInterview() {
      return makeInterview({
        startedByUid: "user-123",
        style: "smart",
        topic: "Test",
        recordingConfig: "video",
        maxDurationSec: 300,
      });
    }

    beforeEach(() => {
      mockVerifyRequest.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });
      mockGetInterview.mockResolvedValue(buildVideoInterview());
    });

    it("returns 503 with code missing_api_key when the Tavus key is unconfigured", async () => {
      mockMintTavusSession.mockRejectedValue(
        new TavusMintError({
          kind: "missing_api_key",
          message:
            "Tavus API key not configured. Add it in Settings > AI Providers.",
        }),
      );

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-id/consent",
        { method: "POST", body: JSON.stringify({ confirmed: true }) },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-id" }),
      });

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.code).toBe("missing_api_key");
      expect(json.error).toMatch(/Tavus API key not configured/);
    });

    it("maps Tavus 401 to a 502 with a key-invalid message and upstream status", async () => {
      mockMintTavusSession.mockRejectedValue(
        new TavusMintError({
          kind: "upstream_error",
          status: 401,
          requestId: "req_x",
          responseBody: "invalid token",
          message: "Tavus mint failed (401): invalid token",
        }),
      );

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-id/consent",
        { method: "POST", body: JSON.stringify({ confirmed: true }) },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-id" }),
      });

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Tavus API key is invalid or unauthorized");
      expect(json.code).toBe("upstream_error");
      expect(json.upstreamStatus).toBe(401);
    });

    it("maps Tavus 429 to a quota/rate-limit message", async () => {
      mockMintTavusSession.mockRejectedValue(
        new TavusMintError({
          kind: "upstream_error",
          status: 429,
          message: "rate limited",
        }),
      );

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-id/consent",
        { method: "POST", body: JSON.stringify({ confirmed: true }) },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-id" }),
      });

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Tavus quota exceeded or rate-limited");
      expect(json.upstreamStatus).toBe(429);
    });

    it("maps Tavus 400 to a request-shape message (catches missing persona_id regressions)", async () => {
      mockMintTavusSession.mockRejectedValue(
        new TavusMintError({
          kind: "upstream_error",
          status: 400,
          message: "bad request",
        }),
      );

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-id/consent",
        { method: "POST", body: JSON.stringify({ confirmed: true }) },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-id" }),
      });

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe(
        "Tavus rejected the request (check replica and persona IDs)",
      );
    });

    it("falls back to the generic message on unexpected (non-TavusMintError) failures", async () => {
      mockMintTavusSession.mockRejectedValue(new Error("kaboom"));

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-id/consent",
        { method: "POST", body: JSON.stringify({ confirmed: true }) },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-id" }),
      });

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe("Failed to initialize video session");
    });
  });
});
