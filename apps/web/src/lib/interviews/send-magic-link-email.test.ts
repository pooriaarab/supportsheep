import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockDebug = vi.hoisted(() => vi.fn());
const mockInfo = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());
const mockWarn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: mockDebug,
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
  }),
}));

const mockSendEmail = vi.hoisted(() => vi.fn(async () => ({ id: "stub-id" })));
vi.mock("@/lib/email/cloudflare-email", () => ({
  sendEmail: mockSendEmail,
}));

import { sendMagicLinkEmail } from "./send-magic-link-email";

interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function lastSendEmailPayload(): SendEmailPayload {
  const calls = mockSendEmail.mock.calls as unknown as Array<[SendEmailPayload]>;
  const call = calls.at(-1);
  if (!call) throw new Error("sendEmail was not called");
  return call[0];
}

describe("send-magic-link-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DEBUG_MAGIC_LINKS;
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("never logs the full URL or recipient email in production", async () => {
    await sendMagicLinkEmail({
      to: "guest@example.com",
      shareLinkToken: "share_token_abc123",
      magicLinkToken: "magic_token_xyz789",
      shareLinkId: "share_doc_abc123",
      magicLinkId: "magicLinkHashedHexDigest0000000000000000000000000000000000000000",
    });

    const allLogCalls = [
      ...mockDebug.mock.calls,
      ...mockInfo.mock.calls,
      ...mockWarn.mock.calls,
      ...mockError.mock.calls,
    ];
    const flat = JSON.stringify(allLogCalls);

    expect(flat).not.toContain("magic_token_xyz789");
    expect(flat).not.toContain("share_token_abc123");
    expect(flat).not.toContain("guest@example.com");
    expect(flat).not.toContain("/api/v1/interviews/magic-link?");

    // One redacted info log with the documented shape.
    expect(mockInfo).toHaveBeenCalledWith(
      "Magic link email sent",
      expect.objectContaining({
        recipientDomain: "example.com",
        shareLinkId: "share_doc_abc123",
      }),
    );
  });

  it("calls the email sender with the expected payload", async () => {
    await sendMagicLinkEmail({
      to: "guest@example.com",
      shareLinkToken: "share_token_abc123",
      magicLinkToken: "magic_token_xyz789",
      shareLinkId: "share_doc_abc123",
      magicLinkId: "magicLinkHashedHexDigest0000000000000000000000000000000000000000",
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = lastSendEmailPayload();
    expect(payload.to).toBe("guest@example.com");
    expect(payload.subject).toBe("Your interview sign-in link");
    // The URL goes into the email body, NOT into the logs.
    expect(payload.html).toContain(
      "https://blogbat.com/api/v1/interviews/magic-link?share=share_token_abc123&code=magic_token_xyz789",
    );
    expect(payload.text).toContain(
      "https://blogbat.com/api/v1/interviews/magic-link?share=share_token_abc123&code=magic_token_xyz789",
    );
  });

  it("respects NEXT_PUBLIC_BASE_URL when composing the URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000");

    await sendMagicLinkEmail({
      to: "guest@example.com",
      shareLinkToken: "share_token_abc123",
      magicLinkToken: "magic_token_xyz789",
      shareLinkId: "share_doc_abc123",
      magicLinkId: "abcdef0000000000",
    });

    const payload = lastSendEmailPayload();
    expect(payload.html).toContain(
      "http://localhost:3000/api/v1/interviews/magic-link?share=share_token_abc123&code=magic_token_xyz789",
    );
  });

  it("in dev with DEBUG_MAGIC_LINKS=true, logs the URL at debug level (never info)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEBUG_MAGIC_LINKS", "true");

    await sendMagicLinkEmail({
      to: "guest@example.com",
      shareLinkToken: "share_token_abc123",
      magicLinkToken: "magic_token_xyz789",
      shareLinkId: "share_doc_abc123",
      magicLinkId: "abcdef0000000000",
    });

    expect(mockDebug).toHaveBeenCalledWith(
      expect.stringContaining("DEBUG_MAGIC_LINKS"),
      expect.objectContaining({
        url: expect.stringContaining("magic_token_xyz789"),
      }),
    );

    // Confirm the redacted info log was still emitted, and never carried the URL.
    const infoFlat = JSON.stringify(mockInfo.mock.calls);
    expect(infoFlat).not.toContain("magic_token_xyz789");
  });

  it("does NOT log the URL in production even if DEBUG_MAGIC_LINKS=true is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEBUG_MAGIC_LINKS", "true");

    await sendMagicLinkEmail({
      to: "guest@example.com",
      shareLinkToken: "share_token_abc123",
      magicLinkToken: "magic_token_xyz789",
      shareLinkId: "share_doc_abc123",
      magicLinkId: "abcdef0000000000",
    });

    const allLogCalls = [
      ...mockDebug.mock.calls,
      ...mockInfo.mock.calls,
      ...mockWarn.mock.calls,
      ...mockError.mock.calls,
    ];
    const flat = JSON.stringify(allLogCalls);
    expect(flat).not.toContain("magic_token_xyz789");
  });
});
