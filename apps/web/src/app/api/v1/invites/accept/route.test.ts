import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyRequest = vi.fn();
const mockLogAuditEvent = vi.fn();
const mockGetInviteByToken = vi.fn();
const mockAcceptInvite = vi.fn();
const mockAddMemberByEmail = vi.fn();

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
  verifyRequest: mockVerifyRequest,
}));

vi.mock("@/lib/audit-log", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock("@/lib/invites/repository", () => ({
  getInviteByToken: mockGetInviteByToken,
  acceptInvite: mockAcceptInvite,
}));

vi.mock("@/lib/tenancy/members", () => ({
  addMemberByEmail: mockAddMemberByEmail,
}));

function postRequest(body: unknown): Request {
  return new Request("http://test.local/api/v1/invites/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const pendingInvite = (email: string) => ({
  id: "inv-1",
  blogId: "blog-1",
  email,
  role: "editor",
  token: "tok",
  invitedBy: "admin-1",
  expiresAt: Date.now() + 100000,
  createdAt: Date.now(),
  acceptedAt: null,
  acceptedBy: null,
});

describe("POST /api/v1/invites/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyRequest.mockResolvedValue({
      uid: "user-1",
      email: "invitee@x.test",
      authTime: 0,
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
    mockAddMemberByEmail.mockResolvedValue({ ok: true, member: {} });
  });

  it("accepts when the session email matches the invite email", async () => {
    mockGetInviteByToken.mockResolvedValue(pendingInvite("invitee@x.test"));
    mockAcceptInvite.mockResolvedValue({
      ok: true,
      invite: pendingInvite("invitee@x.test"),
    });

    const route = await import("./route");
    const res = await route.POST(postRequest({ token: "tok" }) as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      accepted: true,
      blogId: "blog-1",
    });
    expect(mockAcceptInvite).toHaveBeenCalledWith("tok", "user-1");
    expect(mockAddMemberByEmail).toHaveBeenCalledWith(
      "blog-1",
      "invitee@x.test",
      "editor",
    );
  });

  it("rejects with 403 when the session email does not match the invite", async () => {
    mockGetInviteByToken.mockResolvedValue(pendingInvite("someone-else@x.test"));

    const route = await import("./route");
    const res = await route.POST(postRequest({ token: "tok" }) as never);

    expect(res.status).toBe(403);
    expect(mockAcceptInvite).not.toHaveBeenCalled();
    expect(mockAddMemberByEmail).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown token", async () => {
    mockGetInviteByToken.mockResolvedValue(null);

    const route = await import("./route");
    const res = await route.POST(postRequest({ token: "tok" }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 410 for an expired invite", async () => {
    mockGetInviteByToken.mockResolvedValue({
      ...pendingInvite("invitee@x.test"),
      expiresAt: Date.now() - 1,
    });

    const route = await import("./route");
    const res = await route.POST(postRequest({ token: "tok" }) as never);
    expect(res.status).toBe(410);
    expect(mockAcceptInvite).not.toHaveBeenCalled();
  });

  it("returns 409 for an already-accepted invite", async () => {
    mockGetInviteByToken.mockResolvedValue({
      ...pendingInvite("invitee@x.test"),
      acceptedAt: Date.now(),
    });

    const route = await import("./route");
    const res = await route.POST(postRequest({ token: "tok" }) as never);
    expect(res.status).toBe(409);
    expect(mockAcceptInvite).not.toHaveBeenCalled();
  });

  it("matches email case-insensitively", async () => {
    mockVerifyRequest.mockResolvedValue({
      uid: "user-1",
      email: "Invitee@X.TEST",
      authTime: 0,
    });
    mockGetInviteByToken.mockResolvedValue(pendingInvite("invitee@x.test"));
    mockAcceptInvite.mockResolvedValue({
      ok: true,
      invite: pendingInvite("invitee@x.test"),
    });

    const route = await import("./route");
    const res = await route.POST(postRequest({ token: "tok" }) as never);
    expect(res.status).toBe(200);
  });
});
