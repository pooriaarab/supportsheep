import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, dynamic, maxDuration } from "./route";

const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => mockLog,
}));

const mockVerifyInterviewToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interview-token", () => ({
  verifyInterviewToken: mockVerifyInterviewToken,
  // Real implementation — pure string-concat so safe to mirror inline.
  getInterviewTokenCookieName: (interviewId: string) =>
    `interview_token_${interviewId}`,
}));

// Mock worker registry. Tracks the legacy `on/off` plumbing AND the new
// `subscribe()` API so we can verify both the call-site contract and that
// the returned unsubscribe runs on stream cleanup.
const mockOn = vi.hoisted(() => vi.fn());
const mockOff = vi.hoisted(() => vi.fn());
const mockUnsubscribe = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn(() => mockUnsubscribe));
const mockGetCanvas = vi.hoisted(() => vi.fn(() => ({ title: null, sections: [], meta: { description: null, tags: [], suggestedCategory: null } })));
const mockGetOrCreateWorker = vi.hoisted(() => vi.fn(() => ({
  on: mockOn,
  off: mockOff,
  subscribe: mockSubscribe,
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

// Mock events repository (D1 poll)
const mockListEventsSince = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("@/lib/interviews/events-repository", () => ({
  listEventsSince: mockListEventsSince,
}));

// Mock D1 db
vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({})),
}));

describe("GET /api/v1/interviews/[id]/stream", () => {
  const originalRejectFlag = process.env.INTERVIEW_REJECT_QUERY_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default interview: live status, no canvas snapshot
    mockGetInterview.mockResolvedValue({
      id: "test-interview-123",
      blogId: "default",
      status: "live",
      topic: "Test Topic",
      goal: "Test Goal",
      language: "es",
      canvasSnapshot: null,
    });
    // Default to the lenient (cookie-or-query) mode so legacy tests reflect
    // the deprecation-window contract. The strict mode is exercised in its
    // own block below.
    delete process.env.INTERVIEW_REJECT_QUERY_TOKEN;
  });

  afterEach(() => {
    if (originalRejectFlag === undefined) {
      delete process.env.INTERVIEW_REJECT_QUERY_TOKEN;
    } else {
      process.env.INTERVIEW_REJECT_QUERY_TOKEN = originalRejectFlag;
    }
  });

  it("emits a retryable `auth_missing` SSE error frame when no cookie and no query token is present", async () => {
    // Connect-time cookie race (SameSite + magic-link nav). Status stays 200
    // so EventSource considers the connection long enough to deliver the
    // error frame; `retryable: true` tells the client to keep backing off
    // instead of surfacing a hard error to the UI on the first attempt.
    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/stream", {
      method: "GET",
    });

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    // Auth-error SSE responses must carry the same anti-buffering hint
    // as the main stream so the single error frame is delivered to the
    // client immediately rather than held in a proxy buffer.
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    const body = await res.text();
    expect(body).toContain("event: error");
    expect(body).toContain('"reason":"auth_missing"');
    expect(body).toContain('"code":401');
    expect(body).toContain('"retryable":true');
  });

  it("emits a non-retryable `auth_invalid` SSE error frame when cookie token is expired or tampered", async () => {
    mockVerifyInterviewToken.mockReturnValue(null);

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/stream",
      {
        method: "GET",
        headers: {
          cookie: "interview_token_test-interview-123=expired-token",
        },
      },
    );

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("event: error");
    expect(body).toContain('"reason":"auth_invalid"');
    expect(body).toContain('"code":401');
    expect(body).toContain('"retryable":false');
  });

  it("emits a non-retryable `auth_cross_interview` SSE error frame when cookie token belongs to a different interview", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "different-interview-id",
    });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/stream",
      {
        method: "GET",
        headers: {
          cookie: "interview_token_test-interview-123=cross-interview-token",
        },
      },
    );

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("event: error");
    expect(body).toContain('"reason":"auth_cross_interview"');
    expect(body).toContain('"code":403');
    expect(body).toContain('"retryable":false');
  });

  it("emits a non-retryable `auth_invalid` SSE error frame when query-string token is invalid (deprecated fallback)", async () => {
    mockVerifyInterviewToken.mockReturnValue(null);

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/stream?token=invalid-token",
      { method: "GET" },
    );

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("event: error");
    expect(body).toContain('"reason":"auth_invalid"');
  });

  it("should return 200 and initialize SSE stream when authenticated via cookie", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/stream",
      {
        method: "GET",
        headers: {
          cookie: "interview_token_test-interview-123=valid-cookie-token",
        },
      },
    );

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    // Anti-buffering hint for nginx-based intermediaries (Netlify edge,
    // corporate proxies). Without it the keepalive comment lines can be
    // held in a proxy buffer until the idle timeout fires — the W22
    // production symptom where the function logs `interviews:stream
    // keepalive` every few seconds but the browser still sees `SSE
    // stream lost` every ~25–30 s. A regression that drops this header
    // re-opens that loop, so guard it explicitly.
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    // The verifier should have been called with the cookie token, not any
    // query-string value (there isn't one).
    expect(mockVerifyInterviewToken).toHaveBeenCalledWith("valid-cookie-token");
  });

  it("should still accept a query-string token as a deprecated fallback during the migration window", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/stream?token=query-fallback-token",
      { method: "GET" },
    );

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    expect(mockVerifyInterviewToken).toHaveBeenCalledWith("query-fallback-token");
  });

  it("should prefer the cookie over a query-string token when both are present", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/stream?token=query-token",
      {
        method: "GET",
        headers: {
          cookie: "interview_token_test-interview-123=cookie-token",
        },
      },
    );

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    expect(mockVerifyInterviewToken).toHaveBeenCalledWith("cookie-token");
    expect(mockVerifyInterviewToken).not.toHaveBeenCalledWith("query-token");
  });

  it("emits a retryable `auth_missing` SSE error frame for a query-string-only request when INTERVIEW_REJECT_QUERY_TOKEN=true", async () => {
    process.env.INTERVIEW_REJECT_QUERY_TOKEN = "true";

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/stream?token=query-token",
      { method: "GET" },
    );

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("event: error");
    expect(body).toContain('"reason":"auth_missing"');
    // Verifier should NOT have been called — strict mode rejects before
    // any token validation.
    expect(mockVerifyInterviewToken).not.toHaveBeenCalled();
  });

  it("should still accept the cookie when INTERVIEW_REJECT_QUERY_TOKEN=true", async () => {
    process.env.INTERVIEW_REJECT_QUERY_TOKEN = "true";

    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-interview-123/stream",
      {
        method: "GET",
        headers: {
          cookie: "interview_token_test-interview-123=valid-cookie-token",
        },
      },
    );

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    expect(mockVerifyInterviewToken).toHaveBeenCalledWith("valid-cookie-token");
  });

  it("legacy: still initializes SSE stream when query token is the only auth (deprecation window)", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      interviewId: "test-interview-123",
    });

    const req = new NextRequest("http://localhost/api/v1/interviews/test-interview-123/stream?token=valid-token", {
      method: "GET",
    });

    const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // Allow the ReadableStream's async `start` callback to progress past the
    // `await getInterview()` and `await getProviderApiKey()` ticks.
    await new Promise((r) => setTimeout(r, 0));

    expect(mockGetOrCreateWorker).toHaveBeenCalledWith({
      interviewId: "test-interview-123",
      topic: "Test Topic",
      goal: "Test Goal",
      apiKey: "test-key",
      language: "es",
      // W20b: /stream rehydrates a cold-lambda worker from the
      // cross-instance canvas snapshot. This fixture has no snapshot
      // on the interview doc, so the hydrate input is null.
      hydrateFrom: null,
    });
    expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  describe("route segment config (Netlify Function timeout fix)", () => {
    it("opts out of static optimisation so SSE responses are never cached", () => {
      // Without `force-dynamic` Next.js may treat the route as cacheable
      // during build, which silently breaks event streams in production.
      expect(dynamic).toBe("force-dynamic");
    });

    it("exports maxDuration = 300 so Netlify lets the function run for the full interview", () => {
      // Root cause of the post-PR-#207 "drops every few seconds" loop:
      // Netlify Functions default to a 10 s hard timeout no keepalive can
      // extend. Without this opt-in the function is killed mid-stream and
      // the client reconnects in a loop.
      expect(maxDuration).toBe(300);
    });
  });

  describe("structured close-reason logging", () => {
    it("logs `client_disconnect` when the request signal aborts", async () => {
      mockVerifyInterviewToken.mockReturnValue({
        interviewId: "test-interview-123",
      });

      const controller = new AbortController();
      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-123/stream",
        {
          method: "GET",
          headers: { cookie: "interview_token_test-interview-123=t" },
          signal: controller.signal,
        },
      );

      const res = await GET(req, {
        params: Promise.resolve({ id: "test-interview-123" }),
      });
      expect(res.status).toBe(200);

      // Start consuming the stream so the `start` callback finishes its
      // async setup (interview fetch + provider key + worker subscribe).
      const reader = res.body!.getReader();
      // Read one chunk so the abort listener is wired up.
      await reader.read();

      mockLog.info.mockClear();
      controller.abort();
      // Allow the abort listener microtask to run.
      await Promise.resolve();
      await Promise.resolve();

      expect(mockLog.info).toHaveBeenCalledWith(
        "SSE stream closed",
        expect.objectContaining({
          interviewId: "test-interview-123",
          closeReason: "client_disconnect",
          durationMs: expect.any(Number),
        }),
      );

      // Aborting the request must run the worker-unsubscribe path that
      // was previously leaking listeners across SSE reconnects (W9.1).
      // We verify the unsubscribe fn returned by `subscribe()` ran
      // exactly once.
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

      await reader.cancel().catch(() => {});
    });

    it("logs `provider_key_error` when the Claude API key cannot be resolved", async () => {
      mockVerifyInterviewToken.mockReturnValue({
        interviewId: "test-interview-123",
      });
      mockGetProviderApiKey.mockRejectedValueOnce(
        new Error("Claude key missing"),
      );

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-123/stream",
        {
          method: "GET",
          headers: { cookie: "interview_token_test-interview-123=t" },
        },
      );

      const res = await GET(req, {
        params: Promise.resolve({ id: "test-interview-123" }),
      });
      expect(res.status).toBe(200);

      // Drain the stream so the async start() body finishes (and the
      // provider-key rejection runs its close path). When the body has
      // been fully drained, `controller.close()` has been called and the
      // close-reason log will have fired.
      const reader = res.body!.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(mockLog.info).toHaveBeenCalledWith(
        "SSE stream closed",
        expect.objectContaining({
          interviewId: "test-interview-123",
          closeReason: "provider_key_error",
        }),
      );
    });

    it("closes with `startup_error` when a synchronous throw escapes the start() body", async () => {
      // Regression guard for the post-deploy SSE drop loop in prod: when
      // initialization throws a synchronous error, the stream should close
      // with a structured `startup_error` reason so ops can grep for it.
      mockVerifyInterviewToken.mockReturnValue({
        interviewId: "test-interview-123",
      });
      // Make getInterview throw synchronously-ish (rejected promise that
      // the async start() body will throw from)
      mockGetInterview.mockRejectedValueOnce(
        Object.assign(new Error("D1 init failed"), { code: "failed-precondition" }),
      );

      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-123/stream",
        {
          method: "GET",
          headers: { cookie: "interview_token_test-interview-123=t" },
        },
      );

      const res = await GET(req, {
        params: Promise.resolve({ id: "test-interview-123" }),
      });
      expect(res.status).toBe(200);

      // Drain the stream so the start() body's catch path runs.
      const reader = res.body!.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch {
        // ignore
      }

      expect(mockLog.info).toHaveBeenCalledWith(
        "SSE stream closed",
        expect.objectContaining({
          interviewId: "test-interview-123",
          closeReason: "startup_error",
          errorMessage: expect.stringContaining("D1 init failed"),
        }),
      );
    });
  });

  it("emits an SSE keepalive comment every 5s (tightened from 10s for proxy headroom)", async () => {
    vi.useFakeTimers();
    try {
      mockVerifyInterviewToken.mockReturnValue({
        interviewId: "test-interview-123",
      });

      const controller = new AbortController();
      const req = new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-123/stream?token=valid-token",
        { method: "GET", signal: controller.signal },
      );

      const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
      expect(res.status).toBe(200);
      expect(res.body).not.toBeNull();

      // Drain frames out of the stream into a single decoded string so we can
      // assert on the keepalive comment lines without blocking on `read()`.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let collected = "";
      const drain = (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            collected += decoder.decode(value, { stream: true });
          }
        } catch {
          // Reader aborted — expected when we cancel below.
        }
      })();

      // Let the async start() callback finish (interview fetch + provider key).
      await vi.advanceTimersByTimeAsync(0);

      // Just under the 5s keepalive interval — no comment line yet.
      await vi.advanceTimersByTimeAsync(4_900);
      await Promise.resolve();
      await Promise.resolve();
      expect(collected).not.toMatch(/^: keepalive /m);

      // Past the 5s mark — at least one keepalive must have been written.
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
      await Promise.resolve();
      expect(collected).toMatch(/^: keepalive /m);

      expect(mockLog.debug).toHaveBeenCalledWith(
        "interviews:stream keepalive",
        expect.objectContaining({
          interviewId: "test-interview-123",
          sinceOpenMs: expect.any(Number),
          msSinceLastEvent: expect.any(Number),
        }),
      );

      // Trigger cleanup so the keepalive timer is cleared and the test
      // doesn't leak intervals.
      controller.abort();
      await reader.cancel().catch(() => {});
      await drain;
    } finally {
      vi.useRealTimers();
    }
  });

  describe("D1 poll loop — SSE frame format + Last-Event-ID resume", () => {
    function authedReq(headers: Record<string, string> = {}) {
      return new NextRequest(
        "http://localhost/api/v1/interviews/test-interview-123/stream",
        {
          method: "GET",
          headers: {
            cookie: "interview_token_test-interview-123=t",
            ...headers,
          },
        },
      );
    }

    beforeEach(() => {
      mockVerifyInterviewToken.mockReturnValue({
        interviewId: "test-interview-123",
      });
    });

    it("emits `id:` lines using the event ts so EventSource stores it as the resume cursor", async () => {
      vi.useFakeTimers();
      try {
        const ts = "2026-05-22T17:51:28.453Z";
        // Return the writer_diff event on the first poll, then nothing
        mockListEventsSince
          .mockResolvedValueOnce([
            {
              id: "evt-1",
              blogId: "default",
              interviewId: "test-interview-123",
              kind: "writer_diff",
              ts,
              payload: { type: "title_updated", payload: { title: "T" } },
              createdAt: 1,
            },
          ])
          .mockResolvedValue([]);

        const req = authedReq();
        const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
        expect(res.status).toBe(200);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let collected = "";
        const drain = (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              collected += decoder.decode(value, { stream: true });
            }
          } catch {
            // ignore
          }
        })();

        // Let start() run and the first poll fire.
        await vi.advanceTimersByTimeAsync(700);
        await Promise.resolve();
        await Promise.resolve();

        expect(collected).toContain(`id: ${ts}\n`);
        expect(collected).toMatch(/event: writer_diff\n/);

        await reader.cancel().catch(() => {});
        await drain;
      } finally {
        vi.useRealTimers();
      }
    });

    it("skips events whose ts <= Last-Event-ID header (replay-storm dedup)", async () => {
      // Replay-storm guard: when SSE reconnects, the server gets the
      // browser's `Last-Event-ID` header. The D1 cursor starts from that
      // ts so only events strictly after the cursor are forwarded.
      vi.useFakeTimers();
      try {
        const cursor = "2026-05-22T17:52:38.102Z";
        // The initial listEventsSince with the cursor should return only newer events
        mockListEventsSince.mockResolvedValue([
          {
            id: "evt-new",
            blogId: "default",
            interviewId: "test-interview-123",
            kind: "writer_diff",
            ts: "2026-05-22T17:53:17.904Z",
            payload: { type: "title_updated", payload: { title: "T2" } },
            createdAt: 3,
          },
        ]);

        const req = authedReq({ "last-event-id": cursor });
        const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
        expect(res.status).toBe(200);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let collected = "";
        const drain = (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              collected += decoder.decode(value, { stream: true });
            }
          } catch {
            // ignore
          }
        })();

        await vi.advanceTimersByTimeAsync(700);
        await Promise.resolve();
        await Promise.resolve();

        // The poll must have been called with the cursor from Last-Event-ID
        expect(mockListEventsSince).toHaveBeenCalledWith(
          "default",
          "test-interview-123",
          expect.objectContaining({
            cursor: { afterTs: cursor, afterId: "" },
          }),
          expect.anything(),
        );
        // The newer event should have been forwarded
        expect(collected).toContain("id: 2026-05-22T17:53:17.904Z\n");

        await reader.cancel().catch(() => {});
        await drain;
      } finally {
        vi.useRealTimers();
      }
    });

    it("forwards every event when no Last-Event-ID is sent (initial connect)", async () => {
      vi.useFakeTimers();
      try {
        mockListEventsSince
          .mockResolvedValueOnce([
            {
              id: "evt-1",
              blogId: "default",
              interviewId: "test-interview-123",
              kind: "writer_diff",
              ts: "2026-05-22T17:51:28.453Z",
              payload: { type: "section_added", payload: { id: "s-1" } },
              createdAt: 1,
            },
            {
              id: "evt-2",
              blogId: "default",
              interviewId: "test-interview-123",
              kind: "writer_diff",
              ts: "2026-05-22T17:52:06.798Z",
              payload: { type: "title_updated", payload: { title: "T" } },
              createdAt: 2,
            },
          ])
          .mockResolvedValue([]);

        const req = authedReq();
        const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
        expect(res.status).toBe(200);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let collected = "";
        const drain = (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              collected += decoder.decode(value, { stream: true });
            }
          } catch {
            // ignore
          }
        })();

        await vi.advanceTimersByTimeAsync(700);
        await Promise.resolve();
        await Promise.resolve();

        // Both events must be forwarded on initial connect (no cursor filter)
        expect(collected).toContain("id: 2026-05-22T17:51:28.453Z\n");
        expect(collected).toContain("id: 2026-05-22T17:52:06.798Z\n");

        await reader.cancel().catch(() => {});
        await drain;
      } finally {
        vi.useRealTimers();
      }
    });

    it("logs `forwarded_writer_diff` for every writer_diff event emitted via poll", async () => {
      vi.useFakeTimers();
      try {
        mockListEventsSince
          .mockResolvedValueOnce([
            {
              id: "evt-diff-1",
              blogId: "default",
              interviewId: "test-interview-123",
              kind: "writer_diff",
              ts: "2026-05-22T17:51:28.453Z",
              payload: { type: "title_updated", payload: { title: "Bridged Title" } },
              createdAt: 1,
            },
          ])
          .mockResolvedValue([]);

        const req = authedReq();
        const res = await GET(req, { params: Promise.resolve({ id: "test-interview-123" }) });
        expect(res.status).toBe(200);

        const reader = res.body!.getReader();
        await reader.read();
        mockLog.info.mockClear();

        await vi.advanceTimersByTimeAsync(700);
        await Promise.resolve();
        await Promise.resolve();

        expect(mockLog.info).toHaveBeenCalledWith(
          "forwarded_writer_diff",
          expect.objectContaining({
            interviewId: "test-interview-123",
            eventId: "evt-diff-1",
            diffType: "title_updated",
          }),
        );

        await reader.cancel().catch(() => {});
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
