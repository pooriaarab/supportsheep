import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockVerifyRequest = vi.hoisted(() => vi.fn());
const mockMintInterviewToken = vi.hoisted(() => vi.fn(() => "minted-token-xyz"));

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>(
    "@/lib/auth/session",
  );
  return {
    ...actual,
    verifyRequest: mockVerifyRequest,
  };
});

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/interviews/interview-token", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/interviews/interview-token")
  >("@/lib/interviews/interview-token");
  return {
    ...actual,
    mintInterviewToken: mockMintInterviewToken,
  };
});

// Tenancy role resolution for createApiHandler. Each test sets
// `tenantState.role` to drive the 403 vs success branches.
const tenantState = vi.hoisted(() => ({ role: "owner" as string }));
vi.mock("@/lib/tenancy/repository", () => ({
  DEFAULT_BLOG_ID: "default",
  resolveTenantForUser: vi.fn(async () => ({
    blogId: "default",
    role: tenantState.role,
  })),
  getMembershipByUser: vi.fn(),
}));

describe("POST /api/v1/interviews/[id]/stream/auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 if the user is not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth/session");
    mockVerifyRequest.mockRejectedValue(new AuthError("No session cookie", 401));

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/iv-1/stream/auth",
      { method: "POST" },
    );

    const res = await POST(req, { params: Promise.resolve({ id: "iv-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 if the user is authenticated but lacks admin/editor/owner role", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-1",
      email: "u@x.com",
    });
    tenantState.role = "viewer";

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/iv-1/stream/auth",
      { method: "POST" },
    );

    const res = await POST(req, { params: Promise.resolve({ id: "iv-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 204 and sets the scoped HttpOnly interview-token cookie for admins", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-admin",
      email: "a@x.com",
    });
    tenantState.role = "admin";

    const req = new NextRequest(
      "http://localhost/api/v1/interviews/iv-42/stream/auth",
      { method: "POST" },
    );

    const res = await POST(req, { params: Promise.resolve({ id: "iv-42" }) });
    expect(res.status).toBe(204);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("interview_token_iv-42=minted-token-xyz");
    expect(setCookie).toContain("HttpOnly");
    // Lax (not Strict) so the cookie attaches to the very first same-site
    // EventSource after a magic-link arrival — see the connect-time cookie
    // race documented in buildInterviewTokenCookie.
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/api/v1/interviews/iv-42");

    // Body must NOT echo the token (defence in depth — keeps it out of any
    // JS console / fetch-response breadcrumb).
    const body = await res.text();
    expect(body).not.toContain("minted-token-xyz");
  });
});
