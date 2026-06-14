/**
 * Auth-gate coverage for the test-only tool dispatch route.
 *
 * The route MUST 404 unless BOTH `NODE_ENV !== "production"` AND
 * `INTERVIEW_E2E_TEST_SEED === "true"`. These two locks are the only
 * thing keeping a production-leaked env flag from letting an
 * unauthenticated caller overwrite a live interview canvas — see the
 * route file's header comment for the threat model.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "./route";

const mockDispatchTool = vi.hoisted(() => vi.fn());
const mockBuildToolContext = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("@/lib/interviews/tools", () => ({
  dispatchTool: mockDispatchTool,
  buildToolContext: mockBuildToolContext,
}));

const mockGetCanvas = vi.hoisted(() =>
  vi.fn(() => ({
    title: null,
    sections: [],
    meta: { description: null, tags: [], suggestedCategory: null },
  })),
);
const mockWorker = vi.hoisted(() => ({ getCanvas: mockGetCanvas }));
const mockGetOrCreateWorker = vi.hoisted(() => vi.fn(() => mockWorker));
const mockDisposeWorker = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/writer-worker-registry", () => ({
  getOrCreateWorker: mockGetOrCreateWorker,
  disposeWorker: mockDisposeWorker,
}));

const mockGetInterview = vi.hoisted(() => vi.fn());
const mockCreateInterview = vi.hoisted(() => vi.fn());
const mockDeleteInterview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/interviews/interviews-repository", () => ({
  getInterview: mockGetInterview,
  createInterview: mockCreateInterview,
  deleteInterview: mockDeleteInterview,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/v1/interviews/test-only/dispatch-tool",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    },
  );
}

describe("POST /api/v1/interviews/test-only/dispatch-tool — auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockGetInterview.mockResolvedValue({ topic: "x", goal: "y", language: "en" });
    mockDispatchTool.mockResolvedValue({ ok: true, summary: "ok" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when NODE_ENV is production even with the seed flag set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERVIEW_E2E_TEST_SEED", "true");

    const res = await POST(
      makeRequest({
        interviewId: "i-1",
        toolName: "add_heading",
        args: { text: "Hello" },
      }),
    );

    expect(res.status).toBe(404);
    expect(mockDispatchTool).not.toHaveBeenCalled();
  });

  it("returns 404 in development when the seed flag is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERVIEW_E2E_TEST_SEED", "");

    const res = await POST(
      makeRequest({
        interviewId: "i-1",
        toolName: "add_heading",
        args: { text: "Hello" },
      }),
    );

    expect(res.status).toBe(404);
    expect(mockDispatchTool).not.toHaveBeenCalled();
  });

  it("returns 404 when the seed flag is set to something other than 'true'", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERVIEW_E2E_TEST_SEED", "1");

    const res = await POST(
      makeRequest({
        interviewId: "i-1",
        toolName: "add_heading",
        args: { text: "Hello" },
      }),
    );

    expect(res.status).toBe(404);
    expect(mockDispatchTool).not.toHaveBeenCalled();
  });

  it("dispatches the tool when both gates pass", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERVIEW_E2E_TEST_SEED", "true");

    const res = await POST(
      makeRequest({
        interviewId: "i-1",
        toolName: "add_heading",
        args: { text: "Hello" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockDispatchTool).toHaveBeenCalledTimes(1);
    expect(mockDispatchTool).toHaveBeenCalledWith(
      "add_heading",
      { text: "Hello" },
      expect.any(Object),
    );
    const json = (await res.json()) as {
      result: { ok: boolean };
      canvas: { sections: unknown[] };
    };
    expect(json.result.ok).toBe(true);
    expect(json.canvas).toBeDefined();
  });

  it("returns 404 when the interview does not exist and seedIfMissing is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERVIEW_E2E_TEST_SEED", "true");
    mockGetInterview.mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest({
        interviewId: "missing",
        toolName: "add_heading",
        args: { text: "Hello" },
      }),
    );

    expect(res.status).toBe(404);
    expect(mockDispatchTool).not.toHaveBeenCalled();
    expect(mockCreateInterview).not.toHaveBeenCalled();
  });

  it("seeds a live interview doc when seedIfMissing=true and the doc is absent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERVIEW_E2E_TEST_SEED", "true");
    mockGetInterview.mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest({
        interviewId: "fresh-id",
        toolName: "add_heading",
        args: { text: "Hello" },
        seedIfMissing: true,
      }),
    );

    expect(res.status).toBe(200);
    expect(mockCreateInterview).toHaveBeenCalledTimes(1);
    expect(mockCreateInterview).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ status: "live", id: "fresh-id" }),
    );
    expect(mockDispatchTool).toHaveBeenCalledTimes(1);
  });
});

describe("DELETE /api/v1/interviews/test-only/dispatch-tool — cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockDeleteInterview.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function deleteRequest(body: unknown): NextRequest {
    return new NextRequest(
      "http://localhost/api/v1/interviews/test-only/dispatch-tool",
      {
        method: "DELETE",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      },
    );
  }

  it("returns 404 when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERVIEW_E2E_TEST_SEED", "true");

    const res = await DELETE(deleteRequest({ interviewId: "x" }));
    expect(res.status).toBe(404);
    expect(mockDisposeWorker).not.toHaveBeenCalled();
    expect(mockDeleteInterview).not.toHaveBeenCalled();
  });

  it("disposes the worker and deletes the doc when both gates pass", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERVIEW_E2E_TEST_SEED", "true");

    const res = await DELETE(deleteRequest({ interviewId: "x" }));
    expect(res.status).toBe(200);
    expect(mockDisposeWorker).toHaveBeenCalledWith("x");
    expect(mockDeleteInterview).toHaveBeenCalledWith("default", "x");
  });
});
