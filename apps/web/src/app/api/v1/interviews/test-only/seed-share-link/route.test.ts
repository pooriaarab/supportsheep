import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// D1 share-links repository mocks — hoisted so the route binds to them.
const mockCreateShareLink = vi.hoisted(() =>
  vi.fn(async () => ({ id: "seeded-share-link-id" })),
);
const mockDeleteShareLink = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/lib/interviews/share-links-repository", () => ({
  createShareLink: mockCreateShareLink,
  deleteShareLink: mockDeleteShareLink,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
}));

vi.mock("@/lib/interviews/share-link-token", () => ({
  generateShareLinkToken: vi.fn(() => ({
    token: "plain-token",
    hash: "hashed-token",
  })),
}));

// Audit log isn't invoked (auth: "none") but mocked defensively.
vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(),
}));

const ORIGINAL_FLAG = process.env.INTERVIEW_E2E_TEST_SEED;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INTERVIEW_E2E_TEST_SEED = "true";
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) {
    delete process.env.INTERVIEW_E2E_TEST_SEED;
  } else {
    process.env.INTERVIEW_E2E_TEST_SEED = ORIGINAL_FLAG;
  }
});

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/v1/interviews/test-only/seed-share-link",
    {
      method: "Article",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("POST /api/v1/interviews/test-only/seed-share-link", () => {
  it("defaults to transcript / live / link / anonymous when no overrides given", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      token: "plain-token",
      shareLinkId: "seeded-share-link-id",
      visibility: "link",
      authMode: "anonymous",
      recordingConfig: "transcript",
      mode: "live",
    });

    expect(mockCreateShareLink).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        type: "link",
        authMode: "anonymous",
        recordingConfig: "transcript",
        mode: "live",
        tokenHash: "hashed-token",
      }),
    );
  });

  it("persists recordingConfig=audio when supplied", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ recordingConfig: "audio" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recordingConfig).toBe("audio");

    expect(mockCreateShareLink).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ recordingConfig: "audio" }),
    );
  });

  it("accepts recordingConfig=video with tavus IDs (tavus IDs are not persisted to D1)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        recordingConfig: "video",
        tavusPersonaId: "p_test",
        tavusReplicaId: "r_test",
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recordingConfig).toBe("video");

    // The D1 share_links table has no tavus columns; the create input must
    // carry the video recordingConfig but no tavus fields.
    const createArg = (mockCreateShareLink.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(createArg.recordingConfig).toBe("video");
    expect(createArg).not.toHaveProperty("tavusPersonaId");
    expect(createArg).not.toHaveProperty("tavusReplicaId");
  });

  it("persists mode=async when supplied", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ mode: "async" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("async");

    expect(mockCreateShareLink).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ mode: "async" }),
    );
  });

  it("persists authMode=email and visibility=workspace combo", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ authMode: "email", visibility: "workspace" }),
    );

    expect(res.status).toBe(200);
    expect(mockCreateShareLink).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        type: "workspace",
        authMode: "email",
      }),
    );
  });

  it("rejects recordingConfig=video without tavusPersonaId/tavusReplicaId (400)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ recordingConfig: "video" }));

    expect(res.status).toBe(400);
    expect(mockCreateShareLink).not.toHaveBeenCalled();
  });

  it("rejects recordingConfig=video with persona but no replica (400)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        recordingConfig: "video",
        tavusPersonaId: "p_only",
      }),
    );

    expect(res.status).toBe(400);
    expect(mockCreateShareLink).not.toHaveBeenCalled();
  });

  it("rejects invalid recordingConfig enum value (400)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ recordingConfig: "hologram" }),
    );

    expect(res.status).toBe(400);
    expect(mockCreateShareLink).not.toHaveBeenCalled();
  });

  it("returns 404 when INTERVIEW_E2E_TEST_SEED is not 'true', regardless of payload", async () => {
    process.env.INTERVIEW_E2E_TEST_SEED = "false";
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        recordingConfig: "video",
        tavusPersonaId: "p",
        tavusReplicaId: "r",
      }),
    );

    expect(res.status).toBe(404);
    expect(mockCreateShareLink).not.toHaveBeenCalled();
  });

  it("returns 404 when INTERVIEW_E2E_TEST_SEED is unset (production-like)", async () => {
    delete process.env.INTERVIEW_E2E_TEST_SEED;
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(404);
    expect(mockCreateShareLink).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/interviews/test-only/seed-share-link", () => {
  it("deletes the doc when env gate is open", async () => {
    const { DELETE } = await loadRoute();
    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-only/seed-share-link",
      {
        method: "DELETE",
        body: JSON.stringify({ shareLinkId: "abc" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(mockDeleteShareLink).toHaveBeenCalledWith("default", "abc");
  });

  it("returns 404 when env gate is closed", async () => {
    delete process.env.INTERVIEW_E2E_TEST_SEED;
    const { DELETE } = await loadRoute();
    const req = new NextRequest(
      "http://localhost/api/v1/interviews/test-only/seed-share-link",
      {
        method: "DELETE",
        body: JSON.stringify({ shareLinkId: "abc" }),
        headers: { "Content-Type": "application/json" },
      },
    );

    const res = await DELETE(req);
    expect(res.status).toBe(404);
    expect(mockDeleteShareLink).not.toHaveBeenCalled();
  });
});
