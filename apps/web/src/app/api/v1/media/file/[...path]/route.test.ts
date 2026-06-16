import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// auth: "none" — no session/tenancy needed, but createApiHandler imports them.
vi.mock("@/lib/auth/session", () => ({
  verifyRequest: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(),
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: vi.fn(() => ({
    put: vi.fn(),
    get: mockGet,
    delete: vi.fn(),
  })),
}));

function req() {
  return new NextRequest("http://localhost/api/v1/media/file/x", {
    method: "GET",
  });
}

function streamOf(bytes: Uint8Array): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("GET /api/v1/media/file/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-media/ prefixes with 404 without hitting R2 (prefix-lock)", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ path: ["interviews", "secret-audio.webm"] }),
    });
    expect(res.status).toBe(404);
    // The private prefix must never reach the bucket.
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("rejects keys containing a .. segment with 404 without hitting R2 (traversal guard)", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ path: ["media", "..", "interviews", "x.webm"] }),
    });
    expect(res.status).toBe(404);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns 404 when the object is not found", async () => {
    mockGet.mockResolvedValue(null);
    const res = await GET(req(), {
      params: Promise.resolve({ path: ["media", "missing.png"] }),
    });
    expect(res.status).toBe(404);
    expect(mockGet).toHaveBeenCalledWith("media/missing.png");
  });

  it("streams the object with content-type and immutable cache headers", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mockGet.mockResolvedValue({
      body: streamOf(bytes),
      size: bytes.length,
      httpMetadata: { contentType: "image/png" },
      writeHttpMetadata: () => {},
    });

    const res = await GET(req(), {
      params: Promise.resolve({ path: ["media", "123-pic.png"] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-length")).toBe("4");

    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual([1, 2, 3, 4]);
    expect(mockGet).toHaveBeenCalledWith("media/123-pic.png");
  });

  it("falls back to application/octet-stream when contentType is absent", async () => {
    mockGet.mockResolvedValue({
      body: streamOf(new Uint8Array([9])),
      size: 1,
      httpMetadata: {},
      writeHttpMetadata: () => {},
    });

    const res = await GET(req(), {
      params: Promise.resolve({ path: ["media", "blob.bin"] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });
});
