import "server-only";
import { sendEmail } from "@/lib/email/cloudflare-email";
import { createLogger } from "@/lib/logger";

const log = createLogger("interviews:calendar-invite-email");

export interface SendCalendarInviteEmailInput {
  to: string;
  ics: string;
}

/**
 * Email an interview calendar invite. The ICS content is embedded inline in the
 * body (the Cloudflare Email Service binding does not support attachments), so
 * recipients can copy it into their calendar. Best-effort: delivery failures
 * are swallowed by the shared emailer.
 */
export async function sendCalendarInviteEmail(
  input: SendCalendarInviteEmailInput,
): Promise<void> {
  const subject = "Your interview calendar invite";
  const text = [
    "Here is your interview calendar invite.",
    "",
    "Save the details below to your calendar:",
    "",
    input.ics,
  ].join("\n");
  const html = [
    "<p>Here is your interview calendar invite.</p>",
    "<p>Save the details below to your calendar:</p>",
    `<pre>${input.ics
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre>`,
  ].join("");

  await sendEmail({ to: input.to, subject, text, html });
  log.info("Calendar invite email sent", {
    to_domain: input.to.split("@")[1] ?? "unknown",
  });
}
