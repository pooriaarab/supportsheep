/**
 * Integration tests for POST /api/v1/client-logs.
 *
 * Covers:
 *   - Zod validation (rejects malformed bodies)
 *   - Rate limit short-circuits with 429
 *   - Successful ingest forwards each entry to the server logger
 *   - PII redaction is applied before logging
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCheckRateLimit = vi.hoisted(() =>
  vi.fn(async () => ({
    allowed: true,
    limit: 120,
    remaining: 119,
    resetAt: Date.now() + 60_000,
  })),
);
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: { "client-logs": 120 },
  RATE_LIMIT_WINDOW_MS: 60_000,
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => ""),
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: mockLoggerDebug,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  }),
  registerCorrelationIdGetter: vi.fn(),
  withStructuredLog: async <T,>(
    _log: unknown,
    _op: string,
    _ctx: unknown,
    fn: () => Promise<T>,
  ) => fn(),
}));

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/client-logs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/client-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 120,
      remaining: 119,
      resetAt: Date.now() + 60_000,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects bodies missing the entries array (zod validation)", async () => {
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ wrong: true }));
    expect(res.status).toBe(400);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("rejects empty entries arrays", async () => {
    const { POST } = await import("./route");
    const res = await POST(buildRequest({ entries: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects batches over 50 entries (the per-request cap)", async () => {
    const { POST } = await import("./route");
    const entries = Array.from({ length: 51 }, (_, i) => ({
      level: "info",
      context: "test",
      message: `msg-${i}`,
    }));
    const res = await POST(buildRequest({ entries }));
    expect(res.status).toBe(400);
  });

  it("rejects entries with an invalid level", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      buildRequest({
        entries: [{ level: "verbose", context: "x", message: "hi" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 120,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const { POST } = await import("./route");
    const res = await POST(
      buildRequest({
        entries: [{ level: "info", context: "x", message: "hi" }],
      }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("accepts a valid batch and forwards each entry to the server logger", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      buildRequest({
        entries: [
          { level: "info", context: "ui:editor", message: "saved" },
          {
            level: "warn",
            context: "ui:editor",
            message: "stale draft",
            data: { postId: "p1" },
          },
          {
            level: "error",
            context: "ui:editor",
            message: "failed",
            data: { errorKind: "Network" },
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accepted: number };
    expect(body.accepted).toBe(3);

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);

    // Each call attaches `source: "client"` so a single gcloud filter picks them out.
    const infoData = mockLoggerInfo.mock.calls[0]![1] as Record<string, unknown>;
    expect(infoData.source).toBe("client");
    const warnData = mockLoggerWarn.mock.calls[0]![1] as Record<string, unknown>;
    expect(warnData.source).toBe("client");
    expect(warnData.postId).toBe("p1");
  });

  it("redacts entries that contain sensitive substrings before logging", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      buildRequest({
        entries: [
          {
            level: "info",
            context: "auth",
            message: "received bearer token from upstream",
            data: { headers: { authorization: "Bearer abc" }, ok: true },
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    const [msg, data] = mockLoggerInfo.mock.calls[0]!;
    expect(msg).toBe("[REDACTED]");
    const d = data as Record<string, unknown>;
    expect(d.source).toBe("client");
    const headers = d.headers as Record<string, unknown>;
    expect(headers.authorization).toBe("[REDACTED]");
    expect(d.ok).toBe(true);
  });
});
