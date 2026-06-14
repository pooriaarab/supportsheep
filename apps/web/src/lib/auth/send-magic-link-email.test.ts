import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
let envValue: { EMAIL?: { send: typeof sendMock } };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: envValue }),
}));

import { sendMagicLinkEmail } from "./send-magic-link-email";

describe("sendMagicLinkEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envValue = { EMAIL: { send: sendMock } };
  });

  it("sends via the EMAIL binding when present", async () => {
    sendMock.mockResolvedValue({ messageId: "abc" });
    await sendMagicLinkEmail({ email: "u@blogbat.com", url: "https://x/y" });
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      to: "u@blogbat.com",
      subject: expect.any(String),
    });
  });

  it("does not throw when the binding is absent (falls back to logging)", async () => {
    envValue = {};
    await expect(
      sendMagicLinkEmail({ email: "u@blogbat.com", url: "https://x/y" }),
    ).resolves.toBeUndefined();
  });

  it("does not throw when send() rejects (delivery not configured yet)", async () => {
    sendMock.mockRejectedValue(new Error("domain not onboarded"));
    await expect(
      sendMagicLinkEmail({ email: "u@blogbat.com", url: "https://x/y" }),
    ).resolves.toBeUndefined();
  });
});
