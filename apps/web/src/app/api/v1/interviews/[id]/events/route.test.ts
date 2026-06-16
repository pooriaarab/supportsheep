import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: mockVerifyRequest,
}));

const mockVerifyInterviewToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interview-token", () => ({
  verifyInterviewToken: mockVerifyInterviewToken,
  // The shared `resolveInterviewTokenFromRequest` helper reads the cookie
  // name from `getInterviewTokenCookieName`; the route imports it
  // transitively via that helper, so the mock must export it too.
  getInterviewTokenCookieName: (id: string) => `interview_token_${id}`,
}));

// Mock worker registry
const mockAppendTranscript = vi.hoisted(() => vi.fn());
const mockApplyToolCall = vi.hoisted(() => vi.fn());
const mockHydrateFromCanvas = vi.hoisted(() => vi.fn());
// `getCanvas` is widened to `unknown` so individual tests can return
// either an empty canvas or a populated canvas without TypeScript
// narrowing the mock to the first invocation's literal shape.
const mockGetCanvas = vi.hoisted(() =>
  vi.fn<() => unknown>(() => ({
    title: null,
    sections: [],
    meta: { description: null, tags: [], suggestedCategory: null },
  })),
);
const mockGetOrCreateWorker = vi.hoisted(() => vi.fn(() => ({
  appendTranscript: mockAppendTranscript,
  applyToolCall: mockApplyToolCall,
  hydrateFromCanvas: mockHydrateFromCanvas,
  getCanvas: mockGetCanvas,
})));

vi.mock("@/lib/interviews/writer-worker-registry", () => ({
  getOrCreateWorker: mockGetOrCreateWorker,
}));

const mockGetProviderApiKey = vi.hoisted(() =>
  vi.fn().mockResolvedValue("test-key"),
);
vi.mock("@/lib/ai/providers", () => ({
  getProviderApiKey: mockGetProviderApiKey,
}));

// Mock D1 interviews repository
const mockGetInterview = vi.hoisted(() => vi.fn());
const mockUpdateInterview = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
  updateInterview: mockUpdateInterview,
}));

// Mock D1 events repository
const mockAppendEvents = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockListEventsSince = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("@/lib/interviews/events-repository", () => ({
  appendEvents: mockAppendEvents,
  listEventsSince: mockListEventsSince,
}));

// Mock D1 getDb
vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({})),
}));

// Tenancy role resolution for the GET handler (createApiHandler auth:"user").
// Each test sets `tenantState.role` to drive the 403 vs success branches.
const tenantState = vi.hoisted(() => ({ role: "owner" as string }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(),
}));

describe("POST /api/v1/interviews/[id]/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: live interview
    mockGetInterview.mockResolvedValue({
      id: "test-interview-123",
      blogId: "default",
      status: "live",
      topic: null,
      goal: null,
      language: "en",
      canvasSnapshot: null,
    });
  });

  it("should successfully ingest valid events with a valid token", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
      exp: 999999999,
      iat: 12345678,
    });

    const events = [
      {
        ts: new Date().toISOString(),
        kind: "transcript_user",
        payload: { text: "Hello, this is a test transcript." },
      },
      {
        ts: new Date().toISOString(),
        kind: "canvas_update",
        payload: { heading: "Introduction" },
      },
    ];

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-mock-token",
      },
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.accepted).toBe(2);

    // Events persisted to D1 via appendEvents
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    expect(mockAppendEvents).toHaveBeenCalledWith(
      "default",
      "test-interview-123",
      expect.arrayContaining([
        expect.objectContaining({ kind: "transcript_user" }),
        expect.objectContaining({ kind: "canvas_update" }),
      ]),
      expect.anything(),
    );
  });

  it("should return 401 if authorization header is missing", async () => {
    const events = [
      {
        ts: new Date().toISOString(),
        kind: "transcript_user",
        payload: { text: "Hello" },
      },
    ];

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(401);
  });

  it("should return 401 if interview token is invalid", async () => {
    mockVerifyInterviewToken.mockReturnValue(null);

    const events = [
      {
        ts: new Date().toISOString(),
        kind: "transcript_user",
        payload: { text: "Hello" },
      },
    ];

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      headers: {
        Authorization: "Bearer invalid-token",
      },
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(401);
  });

  it("should return 403 if token interviewId does not match params.id", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "different-interview-id",
    });

    const events = [
      {
        ts: new Date().toISOString(),
        kind: "transcript_user",
        payload: { text: "Hello" },
      },
    ];

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      headers: {
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(403);
  });

  it("should return 409 if interview is ended", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    mockGetInterview.mockResolvedValue({
      id: "test-interview-123",
      blogId: "default",
      status: "ended",
    });

    const events = [
      {
        ts: new Date().toISOString(),
        kind: "transcript_user",
        payload: { text: "Hello" },
      },
    ];

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(409);
  });

  it("should return 400 if events array exceeds 100", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    // Generate 101 events
    const events = Array.from({ length: 101 }, () => ({
      ts: new Date().toISOString(),
      kind: "transcript_user",
      payload: { text: "Hello" },
    }));

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(400);
  });

  it("rejects transcript text above the per-field cap (DoS protection)", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    const events = [
      {
        ts: new Date().toISOString(),
        kind: "transcript_user",
        payload: { text: "x".repeat(8_001) },
      },
    ];

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      headers: { Authorization: "Bearer valid-token" },
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(400);
    // Nothing was persisted.
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });

  it("rejects events batches whose total serialized JSON exceeds the byte cap", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    // 100 events × ~7.9 KB transcripts each ≈ 800 KB total — well above the
    // 64 KB cap. Each individual event still passes the per-field 8 KB cap.
    const events = Array.from({ length: 100 }, () => ({
      ts: new Date().toISOString(),
      kind: "transcript_user",
      payload: { text: "x".repeat(7_900) },
    }));

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      headers: { Authorization: "Bearer valid-token" },
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(413);
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });

  it("should invoke getOrCreateWorker and route transcript/tool_call events to worker", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    mockGetInterview.mockResolvedValue({
      id: "test-interview-123",
      blogId: "default",
      status: "live",
      topic: "React 19",
      goal: "Build better hooks",
      language: "es",
      canvasSnapshot: null,
    });

    const events = [
      {
        ts: new Date().toISOString(),
        kind: "transcript_user",
        payload: { text: "user speak" },
      },
      {
        ts: new Date().toISOString(),
        kind: "transcript_ai",
        payload: { text: "ai speak" },
      },
      {
        ts: new Date().toISOString(),
        kind: "tool_call",
        payload: { name: "add_heading", arguments: { text: "Introduction" } },
      },
      {
        ts: new Date().toISOString(),
        kind: "canvas_update",
        payload: { heading: "Introduction" },
      },
    ];

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/events", {
      method: "Article",
      headers: {
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify(events),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);

    expect(mockGetOrCreateWorker).toHaveBeenCalledWith({
      interviewId: "test-interview-123",
      topic: "React 19",
      goal: "Build better hooks",
      apiKey: "test-key",
      language: "es",
      // W20b: events route hydrates a cold-lambda worker from the
      // cross-instance canvas snapshot. This fixture has no snapshot
      // on the interview row, so the hydrate input is null.
      hydrateFrom: null,
    });

    expect(mockAppendTranscript).toHaveBeenCalledTimes(2);
    expect(mockAppendTranscript).toHaveBeenNthCalledWith(1, "user speak");
    expect(mockAppendTranscript).toHaveBeenNthCalledWith(2, "ai speak");
  });

  it("W20b: hydrates a cold-lambda worker from canvasSnapshot and re-flushes after dispatch", async () => {
    // Pre-W20b only /stream wrote `canvasSnapshot`. Tool batches landing on
    // an events lambda that hadn't seen /stream would mutate a fresh,
    // empty worker, drop `insert_paragraph(section-1, …)` into an implicit
    // "Untitled section", and never persist the result. /end's saveDraft
    // fallback then read a stale (or empty) snapshot and the /review page
    // showed body=empty even though the user spoke and the canvas had
    // structure.
    //
    // Post-fix: events route (a) hydrates the worker from the persisted
    // snapshot on cold-lambda init, and (b) re-flushes `canvasSnapshot`
    // after every batch that mutated the worker. This test pins both
    // invariants in a single end-to-end POST.
    mockVerifyInterviewToken.mockReturnValue({ interviewId: "test-w20b" });
    const persistedSnapshot = {
      title: "Solo Grow: What It Means to Build on Your Own",
      sections: [
        {
          id: "section-1",
          heading: "On Building Supportsheep",
          bullets: [],
          paragraphs: ["First paragraph from a prior batch."],
          quotes: [],
          finalized: false,
        },
      ],
      meta: { description: null, tags: [], suggestedCategory: null },
    };
    mockGetInterview.mockResolvedValue({
      id: "test-w20b",
      blogId: "default",
      status: "live",
      topic: "what is supportsheep grow",
      goal: null,
      language: "en",
      canvasSnapshot: persistedSnapshot,
    });

    // The worker mock's `getCanvas` returns the snapshot a real worker
    // would carry after hydration + a follow-up insert_paragraph batch.
    const postBatchCanvas = {
      ...persistedSnapshot,
      sections: [
        {
          ...persistedSnapshot.sections[0],
          paragraphs: [
            ...persistedSnapshot.sections[0].paragraphs,
            "Second paragraph from this batch.",
          ],
        },
      ],
    };
    mockGetCanvas.mockReturnValueOnce(postBatchCanvas);

    const events = [
      {
        ts: new Date().toISOString(),
        kind: "tool_call",
        payload: {
          name: "insert_paragraph",
          arguments: {
            sectionId: "section-1",
            text: "Second paragraph from this batch.",
          },
        },
      },
    ];

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-w20b/events",
      {
        method: "Article",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(events),
      },
    );

    const res = await POST(req, { params: Promise.resolve({ id: "test-w20b" }) });
    expect(res.status).toBe(200);

    // (a) Worker was hydrated from the persisted snapshot.
    expect(mockGetOrCreateWorker).toHaveBeenCalledWith(
      expect.objectContaining({ hydrateFrom: persistedSnapshot }),
    );

    // (b) Snapshot was re-flushed AFTER dispatch with the freshest canvas
    //     — the very state /end's saveDraft will read on a different lambda.
    expect(mockUpdateInterview).toHaveBeenCalledWith(
      "default",
      "test-w20b",
      expect.objectContaining({
        canvasSnapshot: postBatchCanvas,
      }),
      expect.anything(),
    );
  });

  it("forwards chat_input guide notes to the writer worker so they steer the canvas", async () => {
    // Regression: previously the events route ignored `chat_input`, so guide
    // notes were persisted to storage but never reached the writer. The
    // user-visible symptom was "typing in Guiding the Writer + clicking
    // send did nothing".
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });
    mockGetInterview.mockResolvedValue({
      id: "test-interview-123",
      blogId: "default",
      status: "live",
      topic: "AI",
      goal: "Help readers",
      language: "en",
      canvasSnapshot: null,
    });

    const events = [
      {
        ts: new Date().toISOString(),
        kind: "chat_input",
        payload: { text: "Focus more on the cost section." },
      },
      // An empty/whitespace-only guide note must be silently skipped so a
      // mistyped Enter doesn't pollute the transcript.
      {
        ts: new Date().toISOString(),
        kind: "chat_input",
        payload: { text: "   " },
      },
    ];

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/events",
      {
        method: "Article",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(events),
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: "test-interview-123" }),
    });
    expect(res.status).toBe(200);

    expect(mockAppendTranscript).toHaveBeenCalledTimes(1);
    expect(mockAppendTranscript).toHaveBeenCalledWith(
      "[Guide note from author]: Focus more on the cost section.",
    );
  });
});

describe("GET /api/v1/interviews/[id]/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Authenticated user mock
    mockVerifyRequest.mockResolvedValue({
      uid: "test-user-123",
      email: "test@example.com",
    });

    // Default: write-capable role
    tenantState.role = "admin";

    // Default: Events return list from D1
    mockListEventsSince.mockResolvedValue([
      {
        id: "event-1",
        blogId: "default",
        interviewId: "test-id",
        kind: "transcript_user",
        ts: "2026-05-20T12:00:00.000Z",
        payload: { text: "Hello" },
        createdAt: 1,
      },
    ]);
  });

  it("should reject with 403 if user is not admin/editor/owner", async () => {
    tenantState.role = "viewer";

    const req = new NextRequest("http://localhost/api/v1/interviews/test-id/events");
    const res = await GET(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("should allow admin/editor/owner to fetch events with since and limit parameters", async () => {
    const req = new NextRequest("http://localhost/api/v1/interviews/test-id/events?since=2026-05-20T11:59:00.000Z&limit=10");
    const res = await GET(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.events).toHaveLength(1);
    expect(json.events[0]).toEqual({
      id: "event-1",
      ts: "2026-05-20T12:00:00.000Z",
      kind: "transcript_user",
      payload: { text: "Hello" },
    });
  });
});
