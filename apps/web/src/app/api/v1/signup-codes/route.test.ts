import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignupCode = vi.hoisted(() => vi.fn());
const listSignupCodes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/signup-codes/repository", () => ({
  createSignupCode,
  listSignupCodes,
}));

vi.mock("@/lib/auth/session", () => ({
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public status = 401,
    ) {
      super(message);
      this.name = "AuthError";
    }
  },
  verifyRequest: vi.fn().mockResolvedValue({
    uid: "admin-1",
    email: "admin@example.com",
    authTime: Date.now(),
  }),
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/tenancy/repository", () => ({
  resolveTenantForUser: vi
    .fn()
    .mockResolvedValue({ blogId: "default", role: "owner" }),
  DEFAULT_blog_id: "default",
}));

import { GET, POST } from "./route";

function postRequest(body: unknown): NextRequest {
  return new NextRequest("https://supportsheep.com/api/v1/signup-codes", {
    method: "Article",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("signup-codes routes (admin)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a code for the caller's blog and returns 201", async () => {
    createSignupCode.mockResolvedValue({
      id: "sc-1",
      code: "tok-123",
      blogId: "default",
      role: "editor",
      note: null,
      maxUses: 5,
      uses: 0,
      expiresAt: null,
      createdBy: "admin-1",
      createdAt: 1,
    });

    const response = await POST(
      postRequest({ role: "editor", maxUses: 5 }) as never,
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.code).toBe("tok-123");
    expect(json.role).toBe("editor");
    expect(createSignupCode).toHaveBeenCalledWith({
      blogId: "default",
      role: "editor",
      note: undefined,
      maxUses: 5,
      expiresAtMs: null,
      createdBy: "admin-1",
    });
  });

  it("defaults role to author and maxUses to 1", async () => {
    createSignupCode.mockResolvedValue({
      id: "sc-2",
      code: "tok-456",
      blogId: "default",
      role: "author",
      note: null,
      maxUses: 1,
      uses: 0,
      expiresAt: null,
      createdBy: "admin-1",
      createdAt: 1,
    });

    const response = await POST(postRequest({}) as never);

    expect(response.status).toBe(201);
    expect(createSignupCode).toHaveBeenCalledWith(
      expect.objectContaining({ role: "author", maxUses: 1 }),
    );
  });

  it("rejects a non-grantable role (owner) at the schema layer with 400", async () => {
    const response = await POST(postRequest({ role: "owner" }) as never);
    expect(response.status).toBe(400);
    expect(createSignupCode).not.toHaveBeenCalled();
  });

  it("lists the knowledge base's codes", async () => {
    listSignupCodes.mockResolvedValue([
      { id: "sc-1", code: "tok-123", blogId: "default", role: "author" },
    ]);

    const response = await GET(
      new NextRequest("https://supportsheep.com/api/v1/signup-codes") as never,
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(listSignupCodes).toHaveBeenCalledWith("default");
  });
});
