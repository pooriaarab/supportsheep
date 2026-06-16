import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_blog_id: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: "owner",
  })),
}));

const mockCreateMedia = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/repository", () => ({
  createMedia: mockCreateMedia,
  listMedia: vi.fn(),
}));

const mockPut = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: vi.fn(() => ({
    put: mockPut,
    get: mockGet,
    delete: mockDelete,
  })),
}));

function buildUploadRequest(file: File, alt = "") {
  const form = new FormData();
  form.append("file", file);
  if (alt) form.append("alt", alt);
  return new NextRequest("http://localhost/api/v1/media", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/v1/media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({ uid: "user-123", email: "u@x.com" });
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockPut.mockResolvedValue(undefined);
  });

  it("uploads bytes to R2 under a media/ key and returns the serve URL", async () => {
    mockCreateMedia.mockImplementation(async (_blogId, entry) => entry);

    const file = new File([new Uint8Array([1, 2, 3])], "My Photo!.png", {
      type: "image/png",
    });

    const res = await POST(buildUploadRequest(file, "a cat"));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.url).toMatch(
      /^\/api\/v1\/media\/file\/media\/\d+-My_Photo_\.png$/,
    );
    expect(json.filename).toBe("My_Photo_.png");

    // put called with a media/-prefixed key and the file's content type.
    expect(mockPut).toHaveBeenCalledTimes(1);
    const [key, value, opts] = mockPut.mock.calls[0];
    expect(key).toMatch(/^media\/\d+-My_Photo_\.png$/);
    expect(value).toBeInstanceOf(ArrayBuffer);
    expect(opts).toEqual({ httpMetadata: { contentType: "image/png" } });

    // The stored row's storagePath and url match the R2 key.
    const stored = mockCreateMedia.mock.calls[0][1];
    expect(stored.storagePath).toBe(key);
    expect(stored.url).toBe(`/api/v1/media/file/${key}`);
  });

  it("rejects disallowed mime types without touching R2", async () => {
    const file = new File(["x"], "evil.exe", {
      type: "application/x-msdownload",
    });
    const res = await POST(buildUploadRequest(file));
    expect(res.status).toBe(400);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("rejects files over the 10 MB cap", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const file = new File([big], "huge.png", { type: "image/png" });
    const res = await POST(buildUploadRequest(file));
    expect(res.status).toBe(400);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("returns 500 when the R2 put fails", async () => {
    mockPut.mockRejectedValue(new Error("binding missing"));
    const file = new File(["x"], "ok.png", { type: "image/png" });
    const res = await POST(buildUploadRequest(file));
    expect(res.status).toBe(500);
    expect(mockCreateMedia).not.toHaveBeenCalled();
  });
});
