import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
let envValue: { EMAIL?: { send: typeof sendMock } };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: envValue }),
}));

import { sendEmail } from "./cloudflare-email";

describe("sendEmail (Cloudflare EMAIL binding)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    envValue = { EMAIL: { send: sendMock } };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends via the EMAIL binding and returns the message id", async () => {
    sendMock.mockResolvedValue({ messageId: "msg-123" });
    const result = await sendEmail({
      to: "u@blogbat.com",
      subject: "Hello",
      text: "Hi there",
      html: "<p>Hi there</p>",
    });
    expect(result).toEqual({ id: "msg-123" });
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      to: "u@blogbat.com",
      from: "auth@blogbat.com",
      subject: "Hello",
      text: "Hi there",
      html: "<p>Hi there</p>",
    });
  });

  it("falls back to the text body when no html is provided", async () => {
    sendMock.mockResolvedValue({ messageId: "m" });
    await sendEmail({ to: "u@blogbat.com", subject: "S", text: "plain" });
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      text: "plain",
      html: "plain",
    });
  });

  it("uses AUTH_EMAIL_FROM when set, else the default sender", async () => {
    sendMock.mockResolvedValue({ messageId: "m" });
    vi.stubEnv("AUTH_EMAIL_FROM", "custom@blogbat.com");
    await sendEmail({ to: "u@blogbat.com", subject: "S", text: "t" });
    expect(sendMock.mock.calls[0][0].from).toBe("custom@blogbat.com");
  });

  it("honors an explicit from override", async () => {
    sendMock.mockResolvedValue({ messageId: "m" });
    await sendEmail({
      to: "u@blogbat.com",
      from: "explicit@blogbat.com",
      subject: "S",
      text: "t",
    });
    expect(sendMock.mock.calls[0][0].from).toBe("explicit@blogbat.com");
  });

  it("is a best-effort no-op returning {id:null} when the binding is absent", async () => {
    envValue = {};
    const result = await sendEmail({
      to: "u@blogbat.com",
      subject: "S",
      text: "t",
    });
    expect(result).toEqual({ id: null });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never throws when the binding send rejects (returns {id:null})", async () => {
    sendMock.mockRejectedValue(new Error("not onboarded"));
    const result = await sendEmail({
      to: "u@blogbat.com",
      subject: "S",
      text: "t",
    });
    expect(result).toEqual({ id: null });
  });

  it("returns {id:null} when the binding omits a messageId", async () => {
    sendMock.mockResolvedValue({});
    const result = await sendEmail({
      to: "u@blogbat.com",
      subject: "S",
      text: "t",
    });
    expect(result).toEqual({ id: null });
  });
});
