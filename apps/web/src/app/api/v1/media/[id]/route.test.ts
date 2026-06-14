import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "./route";

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
  DEFAULT_BLOG_ID: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: "owner",
  })),
}));

const mockDeleteMedia = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/repository", () => ({
  deleteMedia: mockDeleteMedia,
  getMedia: vi.fn(),
  updateMedia: vi.fn(),
}));

const mockBucketDelete = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media/bucket", () => ({
  getMediaBucket: vi.fn(() => ({
    put: vi.fn(),
    get: vi.fn(),
    delete: mockBucketDelete,
  })),
}));

function deleteReq() {
  return new NextRequest("http://localhost/api/v1/media/abc", {
    method: "DELETE",
  });
}

const ctx = { params: Promise.resolve({ id: "abc" }) };

describe("DELETE /api/v1/media/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({ uid: "user-123", email: "u@x.com" });
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockBucketDelete.mockResolvedValue(undefined);
  });

  it("deletes the R2 object using the row storagePath", async () => {
    mockDeleteMedia.mockResolvedValue({ storagePath: "media/123-pic.png" });

    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
    expect(mockBucketDelete).toHaveBeenCalledWith("media/123-pic.png");
  });

  it("returns 404 and skips R2 delete when the row is missing", async () => {
    mockDeleteMedia.mockResolvedValue(null);

    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(404);
    expect(mockBucketDelete).not.toHaveBeenCalled();
  });

  it("still succeeds when the R2 delete throws (non-fatal)", async () => {
    mockDeleteMedia.mockResolvedValue({ storagePath: "media/123-pic.png" });
    mockBucketDelete.mockRejectedValue(new Error("boom"));

    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
  });
});
