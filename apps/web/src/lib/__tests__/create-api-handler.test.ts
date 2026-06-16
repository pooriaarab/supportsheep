import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { logAuditEvent } from "@/lib/audit-log";
import {
  resolveTenantForUser,
  NeedsOnboardingError,
} from "@/lib/tenancy/repository";

// The tenancy repo is mocked globally (test-utils/tenancy-mock-setup.ts);
// these are the mocked fns we can reconfigure per-test.
const mockResolveTenant = vi.mocked(resolveTenantForUser);

vi.mock("@/lib/auth/session", () => ({
  verifyRequest: vi.fn().mockResolvedValue({
    uid: "user-id",
    email: "user@example.com",
    authTime: Date.now(),
  }),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(() => Promise.resolve()),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

describe("createApiHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs audit success for 2xx responses", async () => {
    const handler = createApiHandler({
      audit: "test_success",
      handler: async () => NextResponse.json({}),
    });

    const request = new NextRequest("http://localhost/api/test");
    await handler(request);
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("does not log audit success for 4xx responses", async () => {
    const handler = createApiHandler({
      audit: "test_error",
      handler: async () =>
        NextResponse.json({ error: "fail" }, { status: 400 }),
    });

    const request = new NextRequest("http://localhost/api/test");
    await handler(request);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("returns 409 needs_onboarding when the user has no blog membership", async () => {
    mockResolveTenant.mockRejectedValueOnce(new NeedsOnboardingError());

    const handler = createApiHandler({
      audit: "test_onboarding",
      handler: async () => NextResponse.json({ ok: true }),
    });

    const request = new NextRequest("http://localhost/api/test");
    const response = await handler(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "needs_onboarding",
    });
    // Onboarding short-circuits before the handler / audit.
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("auth:'session' runs the handler without resolving a tenant (membership-optional)", async () => {
    // A membership-less user (resolveTenantForUser would throw) must still be
    // able to reach onboarding/blog-creation routes. Session mode must NOT call
    // resolveTenantForUser at all.
    mockResolveTenant.mockRejectedValue(new NeedsOnboardingError());

    const handler = createApiHandler({
      auth: "session",
      handler: async ({ blogId, role }) =>
        NextResponse.json({ ok: true, blogId, role }),
    });

    const request = new NextRequest("http://localhost/api/test");
    const response = await handler(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      blogId: "",
      role: null,
    });
    expect(mockResolveTenant).not.toHaveBeenCalled();
  });

  it("returns a 400 response for malformed JSON request bodies", async () => {
    const handler = createApiHandler({
      auth: "none",
      input: z.object({ name: z.string() }),
      handler: async () => NextResponse.json({ ok: true }),
    });

    const request = new NextRequest("http://localhost/api/test", {
      method: "Article",
      body: "",
    });
    const response = await handler(request);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON request body",
    });
    expect(response.status).toBe(400);
  });
});
