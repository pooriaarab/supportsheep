import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyInterviewToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interview-token", () => ({
  verifyInterviewToken: mockVerifyInterviewToken,
  // Required by the shared `resolveInterviewTokenFromRequest` helper that
  // the route uses to source the token from cookie or Authorization header.
  getInterviewTokenCookieName: (id: string) => `interview_token_${id}`,
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

// Capture structured logs so we can assert the "session-lock route failed"
// line is emitted on every 500.
const errorLogs: Array<{ message: string; context: Record<string, unknown> }> = [];
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (message: string, context: Record<string, unknown> = {}) => {
      errorLogs.push({ message, context });
    },
  }),
  registerCorrelationIdGetter: () => {},
}));

// D1 session lock repo mocks
const mockGetSessionLock = vi.hoisted(() => vi.fn());
const mockUpsertHeartbeat = vi.hoisted(() => vi.fn());
const mockDeleteSessionLock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/session-locks-repository", () => ({
  getSessionLock: mockGetSessionLock,
  upsertHeartbeat: mockUpsertHeartbeat,
  deleteSessionLock: mockDeleteSessionLock,
  STALE_LOCK_THRESHOLD_MS: 10_000,
}));

// Import after the mocks so the route picks them up.
import { GET, POST, DELETE } from "./route";

const VALID_TOKEN_PAYLOAD = {
  interviewId: "int-1",
  iat: 0,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

function makeReq(
  method: "GET" | "POST" | "DELETE",
  url = "http://localhost/api/v1/interviews/int-1/session-lock",
  init: { headers?: Record<string, string>; body?: unknown } = {},
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...init.headers,
  };
  return new NextRequest(url, {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  errorLogs.length = 0;
  mockVerifyInterviewToken.mockReturnValue(VALID_TOKEN_PAYLOAD);
});

describe("GET /api/v1/interviews/[id]/session-lock", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeReq("GET"), {
      params: Promise.resolve({ id: "int-1" }),
    } as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the token does not verify", async () => {
    mockVerifyInterviewToken.mockReturnValue(null);
    const res = await GET(
      makeReq("GET", undefined, { headers: { Authorization: "Bearer bad" } }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when the token is for a different interview", async () => {
    mockVerifyInterviewToken.mockReturnValue({
      ...VALID_TOKEN_PAYLOAD,
      interviewId: "OTHER",
    });
    const res = await GET(
      makeReq("GET", undefined, { headers: { Authorization: "Bearer x" } }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with empty-lock payload for a brand-new interview (no lock doc)", async () => {
    mockGetSessionLock.mockResolvedValue(null);
    const res = await GET(
      makeReq("GET", undefined, { headers: { Authorization: "Bearer x" } }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      holder: null,
      lastBeatAt: null,
      stale: false,
    });
    expect(errorLogs).toHaveLength(0);
  });

  it("returns 200 with the current lock holder when a fresh lock exists", async () => {
    const lastBeatMillis = Date.now() - 1_000;
    mockGetSessionLock.mockResolvedValue({
      interviewId: "int-1",
      blogId: "default",
      heartbeatId: "hb_existing",
      lastBeatAt: lastBeatMillis,
    });
    const res = await GET(
      makeReq("GET", undefined, { headers: { Authorization: "Bearer x" } }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.holder).toBe("hb_existing");
    expect(body.lastBeatAt).toBe(lastBeatMillis);
    expect(body.stale).toBe(false);
  });

  it("flags a holder as stale when the last beat is past the threshold", async () => {
    mockGetSessionLock.mockResolvedValue({
      interviewId: "int-1",
      blogId: "default",
      heartbeatId: "hb_old",
      lastBeatAt: Date.now() - 30_000,
    });
    const res = await GET(
      makeReq("GET", undefined, { headers: { Authorization: "Bearer x" } }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.holder).toBe("hb_old");
    expect(body.stale).toBe(true);
  });

  it(
    "returns 500 with a structured 'session-lock route failed' log when " +
      "D1 getSessionLock throws",
    async () => {
      mockGetSessionLock.mockRejectedValue(
        new Error("D1 error: session_locks query failed"),
      );
      const res = await GET(
        makeReq("GET", undefined, { headers: { Authorization: "Bearer x" } }),
        { params: Promise.resolve({ id: "int-1" }) } as never,
      );
      expect(res.status).toBe(500);

      const failureLog = errorLogs.find(
        (entry) => entry.message === "session-lock route failed",
      );
      expect(failureLog).toBeDefined();
      expect(failureLog?.context.method).toBe("GET");
      expect(failureLog?.context.interviewId).toBe("int-1");
      expect(failureLog?.context.requestPath).toBe(
        "/api/v1/interviews/int-1/session-lock",
      );
      expect(failureLog?.context.errorMessage).toContain("D1 error");
      expect(typeof failureLog?.context.errorStack).toBe("string");
    },
  );
});

describe("POST /api/v1/interviews/[id]/session-lock", () => {
  it("acquires the lock when no document exists", async () => {
    mockUpsertHeartbeat.mockResolvedValue({ status: "acquired" });
    const res = await POST(
      makeReq("POST", undefined, {
        headers: { Authorization: "Bearer x" },
        body: { heartbeatId: "hb_new" },
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "acquired" });
    expect(mockUpsertHeartbeat).toHaveBeenCalledWith(
      "default",
      "int-1",
      "hb_new",
      false,
    );
  });

  it("refreshes the lock when the same holder beats again", async () => {
    mockUpsertHeartbeat.mockResolvedValue({ status: "refreshed" });
    const res = await POST(
      makeReq("POST", undefined, {
        headers: { Authorization: "Bearer x" },
        body: { heartbeatId: "hb_same" },
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "refreshed" });
  });

  it("returns 409 conflict when a different fresh holder is active", async () => {
    const conflictResult = {
      status: "conflict" as const,
      currentHolder: "hb_other",
      lastBeatAt: Date.now(),
    };
    mockUpsertHeartbeat.mockResolvedValue(conflictResult);
    const res = await POST(
      makeReq("POST", undefined, {
        headers: { Authorization: "Bearer x" },
        body: { heartbeatId: "hb_new" },
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("conflict");
    expect(body.currentHolder).toBe("hb_other");
  });

  it("returns 500 with a structured log when upsertHeartbeat throws", async () => {
    mockUpsertHeartbeat.mockRejectedValue(new Error("boom"));
    const res = await POST(
      makeReq("POST", undefined, {
        headers: { Authorization: "Bearer x" },
        body: { heartbeatId: "hb_new" },
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(500);

    const failureLog = errorLogs.find(
      (entry) => entry.message === "session-lock route failed",
    );
    expect(failureLog).toBeDefined();
    expect(failureLog?.context.method).toBe("POST");
    expect(failureLog?.context.interviewId).toBe("int-1");
  });
});

describe("DELETE /api/v1/interviews/[id]/session-lock", () => {
  it("returns 400 when the heartbeatId query param is missing", async () => {
    const res = await DELETE(
      makeReq("DELETE", undefined, { headers: { Authorization: "Bearer x" } }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(400);
  });

  it("releases the lock when the caller is the current holder", async () => {
    mockDeleteSessionLock.mockResolvedValue(true);
    const res = await DELETE(
      makeReq("DELETE", "http://localhost/api/v1/interviews/int-1/session-lock?heartbeatId=hb_mine", {
        headers: { Authorization: "Bearer x" },
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ released: true });
    expect(mockDeleteSessionLock).toHaveBeenCalledWith("default", "int-1", "hb_mine");
  });

  it("returns 500 with a structured log when deleteSessionLock throws", async () => {
    mockDeleteSessionLock.mockRejectedValue(new Error("nope"));
    const res = await DELETE(
      makeReq("DELETE", "http://localhost/api/v1/interviews/int-1/session-lock?heartbeatId=hb_mine", {
        headers: { Authorization: "Bearer x" },
      }),
      { params: Promise.resolve({ id: "int-1" }) } as never,
    );
    expect(res.status).toBe(500);
    const failureLog = errorLogs.find(
      (entry) => entry.message === "session-lock route failed",
    );
    expect(failureLog?.context.method).toBe("DELETE");
  });
});
