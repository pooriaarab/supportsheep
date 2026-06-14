import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redeemSignupCode = vi.hoisted(() => vi.fn());
const provisionAgentAccount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/signup-codes/repository", () => ({
  redeemSignupCode,
}));

vi.mock("@/lib/signup-codes/provision", () => ({
  provisionAgentAccount,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: vi.fn(() => Promise.resolve()),
}));

// rateLimit on the route calls checkRateLimit; stub it to always allow.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 10,
    remaining: 9,
    resetAt: Date.now() + 60000,
  }),
}));

import { POST } from "./route";

function postRequest(body: unknown): NextRequest {
  return new NextRequest("https://supportsheep.com/api/v1/agent/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/agent/signup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redeems a valid code, provisions the account, returns the plaintext key once", async () => {
    redeemSignupCode.mockResolvedValue({
      ok: true,
      blogId: "blog-1",
      role: "author",
    });
    provisionAgentAccount.mockResolvedValue({
      userId: "user-1",
      apiKey: "sk-deadbeef",
      keyPreview: "sk-...beef",
    });

    const response = await POST(
      postRequest({ code: "tok-1", email: "agent@example.com", name: "Bot" }) as never,
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.apiKey).toBe("sk-deadbeef");
    expect(json.blogId).toBe("blog-1");
    expect(json.userId).toBe("user-1");
    expect(json.role).toBe("author");
    expect(typeof json.usage).toBe("string");

    expect(redeemSignupCode).toHaveBeenCalledWith("tok-1");
    expect(provisionAgentAccount).toHaveBeenCalledWith({
      email: "agent@example.com",
      name: "Bot",
      blogId: "blog-1",
      role: "author",
    });
  });

  it("reuses an existing email (provision is idempotent on membership)", async () => {
    redeemSignupCode.mockResolvedValue({
      ok: true,
      blogId: "blog-1",
      role: "editor",
    });
    provisionAgentAccount.mockResolvedValue({
      userId: "existing-user",
      apiKey: "sk-new",
      keyPreview: "sk-...new",
    });

    const response = await POST(
      postRequest({ code: "tok-2", email: "existing@example.com" }) as never,
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.userId).toBe("existing-user");
    expect(json.apiKey).toBe("sk-new");
  });

  it("returns 400 for an unknown code and does not provision", async () => {
    redeemSignupCode.mockResolvedValue({ ok: false, reason: "not_found" });

    const response = await POST(
      postRequest({ code: "nope", email: "agent@example.com" }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
    expect(provisionAgentAccount).not.toHaveBeenCalled();
  });

  it("returns 410 for an expired code", async () => {
    redeemSignupCode.mockResolvedValue({ ok: false, reason: "expired" });

    const response = await POST(
      postRequest({ code: "old", email: "agent@example.com" }) as never,
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: "expired" });
    expect(provisionAgentAccount).not.toHaveBeenCalled();
  });

  it("returns 410 for an exhausted code", async () => {
    redeemSignupCode.mockResolvedValue({ ok: false, reason: "exhausted" });

    const response = await POST(
      postRequest({ code: "used", email: "agent@example.com" }) as never,
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: "exhausted" });
  });

  it("returns 400 for invalid input (bad email)", async () => {
    const response = await POST(
      postRequest({ code: "tok", email: "not-an-email" }) as never,
    );
    expect(response.status).toBe(400);
    expect(redeemSignupCode).not.toHaveBeenCalled();
  });
});
