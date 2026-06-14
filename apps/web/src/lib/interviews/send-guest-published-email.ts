import "server-only";
import { sendEmail } from "@/lib/email/cloudflare-email";
import { createLogger } from "@/lib/logger";

const log = createLogger("interviews:guest-published-email");

export interface SendGuestPublishedEmailInput {
  to: string;
  guestName: string | null;
  articleTitle: string;
  articleUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Email a guest that the article from their interview has been published, with
 * a link to the live article. Best-effort: delivery failures are swallowed by
 * the shared emailer.
 */
export async function sendGuestPublishedEmail(
  input: SendGuestPublishedEmailInput,
): Promise<void> {
  const greeting = input.guestName ? `Hi ${input.guestName},` : "Hi,";
  const subject = `"${input.articleTitle}" is now published`;
  const text = [
    greeting,
    "",
    `The article from your interview, "${input.articleTitle}", is now live.`,
    "",
    `Read it here: ${input.articleUrl}`,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>The article from your interview, "${escapeHtml(
      input.articleTitle,
    )}", is now live.</p>`,
    `<p><a href="${escapeHtml(input.articleUrl)}">Read it here</a></p>`,
  ].join("");

  await sendEmail({ to: input.to, subject, text, html });
  log.info("Guest article published email sent", {
    to_domain: input.to.split("@")[1] ?? "unknown",
  });
}
