import { describe, expect, it, vi, beforeEach } from "vitest";

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}
const mockSendEmail = vi.hoisted(() =>
  vi.fn(
    async (_input: EmailPayload): Promise<{ id: string | null }> => ({
      id: "msg",
    }),
  ),
);
vi.mock("@/lib/email/cloudflare-email", () => ({
  sendEmail: mockSendEmail,
}));

const mockInfo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: mockInfo,
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { sendCalendarInviteEmail } from "./send-calendar-invite-email";

describe("send-calendar-invite-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the Cloudflare email helper exactly once with to/subject/text/html and no caller-supplied from", async () => {
    const input = {
      to: "guest@example.com",
      ics: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
    };

    await sendCalendarInviteEmail(input);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = mockSendEmail.mock.calls[0][0];
    expect(payload).toEqual({
      to: "guest@example.com",
      subject: "Your interview calendar invite",
      text: expect.stringContaining("BEGIN:VCALENDAR"),
      html: expect.stringContaining("BEGIN:VCALENDAR"),
    });
    // The sender must not override the helper's default sender.
    expect(payload).not.toHaveProperty("from");
    // Both bodies must be non-empty for deliverability.
    expect(payload.text.length).toBeGreaterThan(0);
    expect(payload.html?.length ?? 0).toBeGreaterThan(0);
  });

  it("escapes HTML-significant characters in the ICS when embedding in the HTML body", async () => {
    await sendCalendarInviteEmail({
      to: "guest@example.com",
      ics: 'SUMMARY:A & B <tag> "x"',
    });
    const payload = mockSendEmail.mock.calls[0][0];
    expect(payload.html).toContain("A &amp; B &lt;tag&gt;");
    // No raw angle brackets from the ICS content should survive into the markup.
    expect(payload.html).not.toContain("<tag>");
    // The plain-text body keeps the original (unescaped) ICS.
    expect(payload.text).toContain('SUMMARY:A & B <tag> "x"');
  });

  it("logs a redacted confirmation (recipient domain only, no full address)", async () => {
    await sendCalendarInviteEmail({ to: "guest@example.com", ics: "x" });
    expect(mockInfo).toHaveBeenCalledWith(
      "Calendar invite email sent",
      expect.objectContaining({ to_domain: "example.com" }),
    );
    // Guard against the full recipient leaking into the log payload.
    expect(JSON.stringify(mockInfo.mock.calls)).not.toContain(
      "guest@example.com",
    );
  });

  it("resolves without throwing when the email helper reports a skipped/failed send (best-effort)", async () => {
    mockSendEmail.mockResolvedValueOnce({ id: null });
    await expect(
      sendCalendarInviteEmail({ to: "guest@example.com", ics: "x" }),
    ).resolves.toBeUndefined();
    // It still logs the confirmation — delivery is best-effort by contract.
    expect(mockInfo).toHaveBeenCalledTimes(1);
  });
});
