import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Stable mocks
// ---------------------------------------------------------------------------

const mockVerifyInterviewToken = vi.hoisted(() => vi.fn());
const mockComputeServerAuthoritativeUsage = vi.hoisted(() => vi.fn());
const mockStitchAsyncInterview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interview-token", () => ({
  verifyInterviewToken: mockVerifyInterviewToken,
  getInterviewTokenCookieName: (interviewId: string) =>
    `interview_token_${interviewId}`,
}));

vi.mock("@/lib/interviews/server-side-usage", () => ({
  computeServerAuthoritativeUsage: mockComputeServerAuthoritativeUsage,
}));

vi.mock("@/lib/interviews/async-stitcher", () => ({
  stitchAsyncInterview: mockStitchAsyncInterview,
}));

vi.mock("@/lib/ai/providers", () => ({
  getProviderApiKey: vi.fn(() => Promise.resolve("mock-claude-key")),
}));

const mockGetBlogConfig = vi.hoisted(() => vi.fn());
vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mockGetBlogConfig,
  resolveBlogConfig: (val: unknown) => val,
}));

// Worker registry
const mockGetWorker = vi.hoisted(() => vi.fn());
const mockDisposeWorker = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/writer-worker-registry", () => ({
  getWorker: mockGetWorker,
  disposeWorker: mockDisposeWorker,
}));

// Mock tenancy repository (create-api-handler calls resolveTenantForUser)
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn().mockResolvedValue({ blogId: "default" }),
}));

// ---------------------------------------------------------------------------
// D1 interviews repository
// ---------------------------------------------------------------------------

const mockGetInterview = vi.hoisted(() => vi.fn());
const mockUpdateInterview = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
  updateInterview: mockUpdateInterview,
}));

// ---------------------------------------------------------------------------
// D1 articles repository
// ---------------------------------------------------------------------------

const mockCreateArticle = vi.hoisted(() => vi.fn());
const mockSlugExists = vi.hoisted(() => vi.fn());
vi.mock("@/lib/articles/repository", () => ({
  createArticle: mockCreateArticle,
  slugExists: mockSlugExists,
  getArticleBySlug: vi.fn(),
}));

// ---------------------------------------------------------------------------
// D1 async-responses repository
// ---------------------------------------------------------------------------

const mockListAsyncResponses = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/async-responses-repository", () => ({
  listAsyncResponses: mockListAsyncResponses,
}));

// ---------------------------------------------------------------------------
// D1 share-links repository
// ---------------------------------------------------------------------------

const mockGetShareLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/share-links-repository", () => ({
  getShareLink: mockGetShareLink,
}));

// ---------------------------------------------------------------------------
// D1 session-locks repository
// ---------------------------------------------------------------------------

const mockReleaseSessionLock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/session-locks-repository", () => ({
  releaseSessionLock: mockReleaseSessionLock,
  deleteSessionLock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// D1 events repository (cost cap warning)
// ---------------------------------------------------------------------------

const mockAppendEvents = vi.hoisted(() => vi.fn());
vi.mock("@/lib/interviews/events-repository", () => ({
  appendEvents: mockAppendEvents,
}));

// ---------------------------------------------------------------------------
// D1 database — mock getDb() for the raw conditional UPDATE + cost cap query
// ---------------------------------------------------------------------------

// Chain mocks — each method returns `this` so the ORM chain compiles
const makeUpdateChain = () => {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue([{ id: "mock-interview-id" }]),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
};
const makeSelectChain = (result: unknown[] = [{ totalCost: 0 }]) => {
  const chain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  return chain;
};

// The mock getDb() factory — each test can override update/select chains.
// _updateChain and _selectChain are exported via closure into the getDb() mock.
let _updateChain = makeUpdateChain();
let _selectChain = makeSelectChain();

vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    update: vi.fn(() => _updateChain),
    select: vi.fn(() => _selectChain),
    insert: vi.fn(),
    delete: vi.fn(),
    batch: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// logger
// ---------------------------------------------------------------------------
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
  registerCorrelationIdGetter: () => {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ARTICLE_ID = "mock-new-article-123";

function makeInterviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-interview-123",
    blogId: "default",
    status: "live",
    startedByUid: "user-123",
    startedByRole: "owner",
    topic: "Test Interview",
    mode: "live",
    startedAt: Date.now() - 300_000,
    endedAt: null,
    articleId: null,
    requiresReview: null,
    shareLinkId: null,
    guestName: null,
    guestEmail: null,
    goal: null,
    language: "en" as const,
    canvasSnapshot: null,
    costUsd: null,
    ...overrides,
  };
}

function makeDefaultCanvas(title = "Test Title") {
  return {
    title,
    sections: [
      {
        id: "section-1",
        heading: null,
        bullets: [],
        paragraphs: ["Live HTML update"],
        quotes: [],
        finalized: false,
      },
    ],
    meta: { description: null, tags: [], suggestedCategory: null },
  };
}

describe("POST /api/v1/interviews/[id]/end", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-create chains so each test gets a clean chain
    _updateChain = makeUpdateChain();
    _selectChain = makeSelectChain();

    mockComputeServerAuthoritativeUsage.mockResolvedValue({
      realtime: { input: 100, output: 50 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });

    mockGetBlogConfig.mockResolvedValue({ interview: { monthlyCostCapUsd: null } });
    mockReleaseSessionLock.mockResolvedValue(false);
    mockUpdateInterview.mockResolvedValue(null);
    mockSlugExists.mockResolvedValue(false);
    mockCreateArticle.mockImplementation((_blogId: string, articleDoc: Record<string, unknown>) =>
      Promise.resolve({
        ok: true as const,
        article: {
          id: MOCK_ARTICLE_ID,
          slug: articleDoc.slug ?? "test-slug",
          blogId: "default",
          ...articleDoc,
        },
      }),
    );
    mockAppendEvents.mockResolvedValue(undefined);
    mockListAsyncResponses.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("should end interview and create article draft on happy path (self-flow owner)", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    mockGetInterview.mockResolvedValue(makeInterviewRow());

    mockGetWorker.mockReturnValue({
      getCanvas: () => ({
        title: "Interview: Building the Lifecycle API",
        sections: [
          {
            id: "section-1",
            heading: null,
            bullets: [],
            paragraphs: ["Live HTML update"],
            quotes: [],
            finalized: false,
          },
        ],
        meta: { description: null, tags: [], suggestedCategory: null },
      }),
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/end", {
      method: "Article",
      headers: { Authorization: "Bearer valid-mock-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.articleId).toBe(MOCK_ARTICLE_ID);
    expect(json.requiresReview).toBe(false); // owner self-flow -> draft status

    expect(mockCreateArticle).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        title: "Interview: Building the Lifecycle API",
        status: "draft",
        generatedBy: "interview",
      }),
    );

    expect(mockUpdateInterview).toHaveBeenCalledWith(
      "default",
      "test-interview-123",
      expect.objectContaining({
        articleId: MOCK_ARTICLE_ID,
        publishedDirect: true,
      }),
    );

    expect(mockDisposeWorker).toHaveBeenCalledWith("test-interview-123");
  });

  // -------------------------------------------------------------------------
  // Idempotency: already ended WITH articleId
  // -------------------------------------------------------------------------

  it("should be idempotent if the interview has already ended", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    mockGetInterview.mockResolvedValue(
      makeInterviewRow({ status: "ended", articleId: "existing-article-456" }),
    );

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/end", {
      method: "Article",
      headers: { Authorization: "Bearer valid-mock-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.articleId).toBe("existing-article-456");
    expect(mockCreateArticle).not.toHaveBeenCalled();
    // updateInterview must not be called for status flip on idempotent path
    expect(mockUpdateInterview).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 409: not live
  // -------------------------------------------------------------------------

  it("should return 409 if interview is not live or already ended (consent state)", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    mockGetInterview.mockResolvedValue(
      makeInterviewRow({ status: "consent", articleId: null }),
    );

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/end", {
      method: "Article",
      headers: { Authorization: "Bearer valid-mock-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(409);
  });

  // -------------------------------------------------------------------------
  // 401/403
  // -------------------------------------------------------------------------

  it("should return 401 if token is invalid", async () => {
    mockVerifyInterviewToken.mockReturnValue(null);

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/end", {
      method: "Article",
      headers: { Authorization: "Bearer invalid-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(401);
  });

  it("should return 403 if token interview ID does not match params", async () => {
    mockVerifyInterviewToken.mockReturnValue({ interviewId: "other-interview" });

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/end", {
      method: "Article",
      headers: { Authorization: "Bearer valid-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // Cost cap breach
  // -------------------------------------------------------------------------

  it("should detect cost cap breach, flag the interview, and add a warning event", async () => {
    mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-123" });
    mockGetInterview.mockResolvedValue(makeInterviewRow({ costUsd: 0 }));

    mockGetBlogConfig.mockResolvedValue({ interview: { monthlyCostCapUsd: 10 } });

    // Monthly cost query returns a stored total just below $10 —
    // but after adding freshly computed cost the cap is breached.
    _selectChain = makeSelectChain([{ totalCost: 12 }]); // stored total already > cap

    mockGetWorker.mockReturnValue({
      getCanvas: () => makeDefaultCanvas("Cost cap test"),
    });

    mockComputeServerAuthoritativeUsage.mockResolvedValue({
      realtime: { input: 100, output: 50 },
      writer: { input: 0, cachedInput: 0, output: 0 },
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/end", {
      method: "Article",
      headers: { Authorization: "Bearer valid-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);

    expect(mockAppendEvents).toHaveBeenCalledWith(
      "default",
      "test-interview-123",
      expect.arrayContaining([
        expect.objectContaining({
          kind: "warning",
          payload: expect.objectContaining({ type: "cost_cap_exceeded" }),
        }),
      ]),
    );
  });

  it("returns 200 even when the cost-cap query throws (non-fatal telemetry)", async () => {
    mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-123" });
    mockGetInterview.mockResolvedValue(makeInterviewRow());
    mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas() });
    mockGetBlogConfig.mockResolvedValue({ interview: { monthlyCostCapUsd: 10 } });

    // Cost-cap query fails
    const failChain = {
      from: vi.fn(),
      where: vi.fn().mockRejectedValue(new Error("FAILED_PRECONDITION: index missing")),
    };
    failChain.from.mockReturnValue(failChain);
    _selectChain = failChain as unknown as typeof _selectChain;

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/end", {
      method: "Article",
      headers: { Authorization: "Bearer valid-mock-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.articleId).toBe(MOCK_ARTICLE_ID);
  });

  it("returns 200 when the metrics update throws (non-fatal telemetry)", async () => {
    mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-123" });
    mockGetInterview.mockResolvedValue(makeInterviewRow());
    mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas() });
    mockGetBlogConfig.mockResolvedValue({ interview: { monthlyCostCapUsd: null } });

    // First call = status flip (ok), second call = metrics update (fails)
    let updateCallCount = 0;
    mockUpdateInterview.mockImplementation(() => {
      updateCallCount++;
      if (updateCallCount === 2) {
        return Promise.reject(new Error("UNAVAILABLE: backend overloaded"));
      }
      return Promise.resolve(null);
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/end", {
      method: "Article",
      headers: { Authorization: "Bearer valid-mock-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.articleId).toBe(MOCK_ARTICLE_ID);
  });

  // -------------------------------------------------------------------------
  // F-003: server-authoritative usage
  // -------------------------------------------------------------------------

  describe("F-003 regression: cost-cap uses server-authoritative usage", () => {
    it("does NOT use client-reported usage — invokes server-side aggregator instead", async () => {
      mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-id" });
      mockGetInterview.mockResolvedValue(makeInterviewRow({ id: "test-id" }));
      mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas("x") });
      mockGetBlogConfig.mockResolvedValue({ interview: { monthlyCostCapUsd: null } });

      mockComputeServerAuthoritativeUsage.mockResolvedValue({
        realtime: { input: 50_000, output: 50_000 },
        writer: { input: 0, cachedInput: 0, output: 0 },
      });

      const req = new NextRequest("http://localhost/api/v1/interviews/test-id/end", {
        method: "Article",
        headers: { Authorization: "Bearer valid" },
      });

      const res = await POST(req, { params: Promise.resolve({ id: "test-id" }) });
      expect(res.status).toBe(200);

      expect(mockComputeServerAuthoritativeUsage).toHaveBeenCalledWith("default", "test-id");

      // The persisted costUsd reflects the server-authoritative numbers
      expect(mockUpdateInterview).toHaveBeenCalledWith(
        "default",
        "test-id",
        expect.objectContaining({ costUsd: expect.any(Number) }),
      );
      const metricsCall = mockUpdateInterview.mock.calls.find(
        (c) => "costUsd" in (c[2] as Record<string, unknown>),
      );
      expect(metricsCall![2].costUsd).toBeGreaterThan(0);
    });

    it("flags costCapBreach even when the browser would have reported zero tokens", async () => {
      mockVerifyInterviewToken.mockReturnValue({ interviewId: "evil-id" });
      mockGetInterview.mockResolvedValue(makeInterviewRow({ id: "evil-id", costUsd: 0 }));
      mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas("x") });
      mockGetBlogConfig.mockResolvedValue({ interview: { monthlyCostCapUsd: 0.10 } });

      // Monthly total already covers the cap
      _selectChain = makeSelectChain([{ totalCost: 0.20 }]);

      mockComputeServerAuthoritativeUsage.mockResolvedValue({
        realtime: { input: 100_000, output: 100_000 },
        writer: { input: 0, cachedInput: 0, output: 0 },
      });

      const req = new NextRequest("http://localhost/api/v1/interviews/evil-id/end", {
        method: "Article",
        headers: { Authorization: "Bearer valid" },
      });

      const res = await POST(req, { params: Promise.resolve({ id: "evil-id" }) });
      expect(res.status).toBe(200);

      expect(mockAppendEvents).toHaveBeenCalledWith(
        "default",
        "evil-id",
        expect.arrayContaining([
          expect.objectContaining({
            kind: "warning",
            payload: expect.objectContaining({ type: "cost_cap_exceeded" }),
          }),
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Wave 7 regressions: bulletproof /end
  // -------------------------------------------------------------------------

  describe("Wave 7 regression: /end remains bulletproof after Wave 5/6", () => {
    it("returns 200 with draftStatus=pending when saveDraft (live) throws", async () => {
      mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-123" });
      mockGetInterview.mockResolvedValue(makeInterviewRow());
      mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas("saveDraft resilience") });
      mockGetBlogConfig.mockResolvedValue({ interview: { monthlyCostCapUsd: null } });

      // saveDraft's article write fails
      mockCreateArticle.mockRejectedValueOnce(new Error("UNAVAILABLE: backend overloaded"));

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-123/end",
        { method: "Article", headers: { Authorization: "Bearer valid-mock-token" } },
      );

      const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.articleId).toBeNull();
      expect(json.draftStatus).toBe("pending");
      expect(json.failingStep).toBe("live:save-draft");
    });

    it("second /end on an already-ended interview returns 200 with the existing summary", async () => {
      mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-double-click" });
      mockGetInterview.mockResolvedValue(
        makeInterviewRow({
          id: "test-interview-double-click",
          status: "ended",
          articleId: "existing-article-from-first-call",
          requiresReview: false,
        }),
      );

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-double-click/end",
        { method: "Article", headers: { Authorization: "Bearer valid-mock-token" } },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-double-click" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.articleId).toBe("existing-article-from-first-call");
      expect(json.requiresReview).toBe(false);
      expect(mockCreateArticle).not.toHaveBeenCalled();
    });

    it("accepts the interview token from the cookie when the Authorization header is absent (F-006)", async () => {
      mockVerifyInterviewToken.mockReturnValue({
        interviewId: "test-interview-cookie-auth",
      });
      mockGetInterview.mockResolvedValue(
        makeInterviewRow({ id: "test-interview-cookie-auth" }),
      );
      mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas("Cookie auth path") });

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-cookie-auth/end",
        {
          method: "Article",
          headers: {
            cookie: "interview_token_test-interview-cookie-auth=valid-cookie-token",
          },
        },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-cookie-auth" }),
      });

      expect(res.status).toBe(200);
      expect(mockVerifyInterviewToken).toHaveBeenCalledWith("valid-cookie-token");
    });

    it("releases the session lock when /end completes successfully", async () => {
      mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-lock-release" });
      mockGetInterview.mockResolvedValue(
        makeInterviewRow({ id: "test-interview-lock-release" }),
      );
      mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas("Lock release") });

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-lock-release/end",
        { method: "Article", headers: { Authorization: "Bearer valid-mock-token" } },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-lock-release" }),
      });

      expect(res.status).toBe(200);
      expect(mockReleaseSessionLock).toHaveBeenCalledTimes(1);
      expect(mockReleaseSessionLock).toHaveBeenCalledWith("test-interview-lock-release");
    });

    it("returns 200 even when the session-lock release throws (best-effort)", async () => {
      mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-lock-throw" });
      mockGetInterview.mockResolvedValue(
        makeInterviewRow({ id: "test-interview-lock-throw" }),
      );
      mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas("Lock release throws") });

      mockReleaseSessionLock.mockRejectedValueOnce(new Error("UNAVAILABLE: lock read failed"));

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-lock-throw/end",
        { method: "Article", headers: { Authorization: "Bearer valid-mock-token" } },
      );

      const res = await POST(req, {
        params: Promise.resolve({ id: "test-interview-lock-throw" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.articleId).toBe(MOCK_ARTICLE_ID);
    });

    it("idempotent retry after saveDraft failure eventually returns the new articleId", async () => {
      mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-recovery" });
      mockGetWorker.mockReturnValue({ getCanvas: () => makeDefaultCanvas("Recovery") });

      // First call — interview is live, saveDraft fails.
      mockGetInterview.mockResolvedValueOnce(makeInterviewRow({ id: "test-interview-recovery" }));
      mockCreateArticle.mockRejectedValueOnce(new Error("UNAVAILABLE: transient"));

      const firstReq = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-recovery/end",
        { method: "Article", headers: { Authorization: "Bearer valid-mock-token" } },
      );
      const firstRes = await POST(firstReq, {
        params: Promise.resolve({ id: "test-interview-recovery" }),
      });
      expect(firstRes.status).toBe(200);
      expect((await firstRes.json()).draftStatus).toBe("pending");

      // Second call — interview is now ended with no articleId (recovery path).
      mockGetInterview.mockResolvedValueOnce(
        makeInterviewRow({ id: "test-interview-recovery", status: "ended", articleId: null }),
      );
      // saveDraft now succeeds (default mock)
      mockCreateArticle.mockImplementationOnce(
        (_blogId: string, articleDoc: Record<string, unknown>) =>
          Promise.resolve({
            ok: true as const,
            article: { id: MOCK_ARTICLE_ID, slug: "recovery-slug", blogId: "default", ...articleDoc },
          }),
      );

      const secondReq = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-recovery/end",
        { method: "Article", headers: { Authorization: "Bearer valid-mock-token" } },
      );
      const secondRes = await POST(secondReq, {
        params: Promise.resolve({ id: "test-interview-recovery" }),
      });
      expect(secondRes.status).toBe(200);
      const secondJson = await secondRes.json();
      expect(secondJson.articleId).toBe(MOCK_ARTICLE_ID);
      expect(secondJson.draftStatus).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Async mode
  // -------------------------------------------------------------------------

  it("should support ending an interview in mode: async, calling stitchAsyncInterview and creating a draft", async () => {
    mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-async" });

    mockGetInterview.mockResolvedValue(
      makeInterviewRow({
        id: "test-interview-async",
        mode: "async",
        startedByRole: "admin",
        shareLinkId: "share-link-abc",
        topic: "My Async Journey",
        language: "en",
      }),
    );

    mockGetShareLink.mockResolvedValue({
      id: "share-link-abc",
      asyncQuestions: [{ id: "q1", text: "What is async pre-recorded mode?" }],
    });

    mockListAsyncResponses.mockResolvedValue([
      {
        id: "resp-1",
        blogId: "default",
        interviewId: "test-interview-async",
        questionId: "q1",
        transcript: "It is a new interview mode in Superset.",
        audioStoragePath: "path.webm",
        createdAt: Date.now(),
      },
    ]);

    const mockCanvasState = {
      title: "My Async Journey",
      sections: [
        {
          id: "section-1",
          heading: "Introduction",
          bullets: [],
          paragraphs: ["It is a new interview mode in Superset."],
          quotes: [],
          finalized: true,
        },
      ],
      meta: {
        description: "SEO Description",
        tags: ["async", "superset"],
        suggestedCategory: "Engineering",
      },
    };

    mockStitchAsyncInterview.mockResolvedValue(mockCanvasState);

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-async/end", {
      method: "Article",
      headers: { Authorization: "Bearer valid-token" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-async" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.articleId).toBe(MOCK_ARTICLE_ID);
    expect(mockStitchAsyncInterview).toHaveBeenCalledWith(
      expect.objectContaining({
        questions: expect.any(Array),
        responses: expect.any(Array),
        topic: "My Async Journey",
        language: "en",
      }),
    );
  });

  // -------------------------------------------------------------------------
  // W19f: post-interview draft visibility
  // -------------------------------------------------------------------------

  describe("post-interview draft visibility on /[postId] (W19f)", () => {
    it("integration: end → review → postId chain serves the saved canvas body when no in-memory worker exists", async () => {
      mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-interview-w19f" });

      const persistedCanvas = {
        title: "W19f: Post-interview draft visibility",
        sections: [
          {
            id: "s-1",
            heading: "Why drafts went missing",
            bullets: ["Cross-lambda canvas loss"],
            paragraphs: ["The /end lambda lacked the in-memory worker."],
            quotes: [],
            finalized: true,
          },
        ],
        meta: { description: null, tags: [], suggestedCategory: null },
      };

      mockGetInterview.mockResolvedValue(
        makeInterviewRow({
          id: "test-interview-w19f",
          startedByRole: "author",
          topic: "W19f",
          canvasSnapshot: persistedCanvas,
        }),
      );

      // Cross-instance scenario — this /end lambda has NO in-memory worker
      mockGetWorker.mockReturnValue(null);

      // Capture the doc that createArticle receives
      let writtenArticleDoc: Record<string, unknown> | undefined;
      mockCreateArticle.mockImplementationOnce(
        (_blogId: string, articleDoc: Record<string, unknown>) => {
          writtenArticleDoc = articleDoc;
          return Promise.resolve({
            ok: true as const,
            article: { id: MOCK_ARTICLE_ID, slug: "w19f-slug", blogId: "default", ...articleDoc },
          });
        },
      );

      const endReq = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-w19f/end",
        { method: "Article", headers: { Authorization: "Bearer valid-mock-token" } },
      );
      const endRes = await POST(endReq, {
        params: Promise.resolve({ id: "test-interview-w19f" }),
      });
      expect(endRes.status).toBe(200);
      const endJson = await endRes.json();
      expect(endJson.articleId).toBe(MOCK_ARTICLE_ID);
      expect(endJson.draftStatus).toBeUndefined();
      // author role → requires review
      expect(endJson.requiresReview).toBe(true);

      // The article body must contain the canvas content
      expect(writtenArticleDoc).toBeDefined();
      const articleBody = String(writtenArticleDoc?.body ?? "");
      const articleDraftBody = String(writtenArticleDoc?.draftBody ?? "");

      expect(articleBody.length).toBeGreaterThan(0);
      expect(articleBody).toContain("<h1>W19f: Post-interview draft visibility</h1>");
      expect(articleBody).toContain("<h2>Why drafts went missing</h2>");
      expect(articleBody).toContain("<li>Cross-lambda canvas loss</li>");
      expect(articleBody).toContain("<p>The /end lambda lacked the in-memory worker.</p>");
      expect(articleDraftBody).toBe(articleBody);

      // Interview linked to the new article
      expect(mockUpdateInterview).toHaveBeenCalledWith(
        "default",
        "test-interview-w19f",
        expect.objectContaining({ articleId: MOCK_ARTICLE_ID }),
      );
    });
  });
});
