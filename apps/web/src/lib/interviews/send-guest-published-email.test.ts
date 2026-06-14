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

import { sendGuestPublishedEmail } from "./send-guest-published-email";

describe("send-guest-published-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the Cloudflare email helper exactly once with to/subject/text/html and no caller-supplied from", async () => {
    const input = {
      to: "guest@example.com",
      guestName: "Jane Doe",
      articleTitle: "My Awesome Journey",
      articleUrl: "https://blogbat.com/my-awesome-journey",
    };

    await sendGuestPublishedEmail(input);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = mockSendEmail.mock.calls[0][0];
    expect(payload.to).toBe("guest@example.com");
    expect(payload.subject).toBe('"My Awesome Journey" is now published');
    expect(payload.text).toContain("Hi Jane Doe,");
    expect(payload.text).toContain("My Awesome Journey");
    expect(payload.text).toContain("https://blogbat.com/my-awesome-journey");
    expect(payload.html).toContain("https://blogbat.com/my-awesome-journey");
    // The sender must not override the helper's default sender.
    expect(payload).not.toHaveProperty("from");
    expect(payload.text.length).toBeGreaterThan(0);
    expect(payload.html?.length ?? 0).toBeGreaterThan(0);
  });

  it("falls back to a generic greeting when the guest name is missing", async () => {
    await sendGuestPublishedEmail({
      to: "guest@example.com",
      guestName: null,
      articleTitle: "Title",
      articleUrl: "https://blogbat.com/title",
    });
    const payload = mockSendEmail.mock.calls[0][0];
    expect(payload.text).toContain("Hi,");
    expect(payload.text).not.toContain("Hi null");
    expect(payload.html).toContain("<p>Hi,</p>");
  });

  it("escapes HTML-significant characters in title, url, and guest name", async () => {
    await sendGuestPublishedEmail({
      to: "guest@example.com",
      guestName: 'A & "B" <c>',
      articleTitle: 'Title & <script>',
      articleUrl: 'https://blogbat.com/x?a=1&b="2"',
    });
    const payload = mockSendEmail.mock.calls[0][0];
    // No unescaped angle brackets from user-supplied content survive into HTML.
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).not.toContain("<c>");
    expect(payload.html).toContain("Title &amp; &lt;script&gt;");
    expect(payload.html).toContain("&amp;b=&quot;2&quot;");
    // The href is escaped too — quotes can't break out of the attribute.
    expect(payload.html).not.toContain('a=1&b="2"');
  });

  it("logs a redacted confirmation (recipient domain only, no full address)", async () => {
    await sendGuestPublishedEmail({
      to: "guest@example.com",
      guestName: "Jane",
      articleTitle: "Title",
      articleUrl: "https://blogbat.com/title",
    });
    expect(mockInfo).toHaveBeenCalledWith(
      "Guest article published email sent",
      expect.objectContaining({ to_domain: "example.com" }),
    );
    expect(JSON.stringify(mockInfo.mock.calls)).not.toContain(
      "guest@example.com",
    );
  });

  it("resolves without throwing when the email helper reports a skipped/failed send (best-effort)", async () => {
    mockSendEmail.mockResolvedValueOnce({ id: null });
    await expect(
      sendGuestPublishedEmail({
        to: "guest@example.com",
        guestName: "Jane",
        articleTitle: "Title",
        articleUrl: "https://blogbat.com/title",
      }),
    ).resolves.toBeUndefined();
    expect(mockInfo).toHaveBeenCalledTimes(1);
  });
});
