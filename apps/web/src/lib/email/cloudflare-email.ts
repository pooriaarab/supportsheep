import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createLogger } from "@/lib/logger";

const log = createLogger("email:cloudflare");

/** Default sender for transactional email (shared with the auth emailer). */
const DEFAULT_FROM = "auth@supportsheep.com";

/**
 * The Cloudflare Email Service binding (`send_email` in wrangler.jsonc). Optional
 * until supportsheep.com is onboarded in the dashboard's Email Sending section.
 */
export interface EmailBinding {
  send: (message: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<{ messageId?: string } | unknown>;
}

export interface SendEmailInput {
  /** Recipient address. */
  to: string;
  /** Sender address. Defaults to `AUTH_EMAIL_FROM`, then `auth@supportsheep.com`. */
  from?: string;
  /** Subject line. */
  subject: string;
  /** Plain-text body. Required for deliverability. */
  text: string;
  /** Optional HTML body. Falls back to the plain text when omitted. */
  html?: string;
}

/**
 * Send a transactional email via the Cloudflare Email Service `EMAIL` worker
 * binding. Best-effort and resilient (mirrors `send-magic-link-email`): when the
 * binding is absent or the send throws, this logs a warning and returns
 * `{ id: null }` — it NEVER throws, so a delivery failure can never break the
 * calling flow. Returns the provider message id when available.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<{ id: string | null }> {
  const from = input.from ?? process.env.AUTH_EMAIL_FROM ?? DEFAULT_FROM;
  const html = input.html ?? input.text;

  const env = getCloudflareContext().env as { EMAIL?: EmailBinding };
  if (!env.EMAIL?.send) {
    log.warn("email send skipped (EMAIL binding not configured)", {
      to_domain: input.to.split("@")[1] ?? "unknown",
      subject: input.subject,
      from,
    });
    return { id: null };
  }

  try {
    const result = (await env.EMAIL.send({
      to: input.to,
      from,
      subject: input.subject,
      text: input.text,
      html,
    })) as { messageId?: string } | undefined;
    return { id: result?.messageId ?? null };
  } catch (err) {
    log.warn("email send failed — continuing (best-effort)", {
      to_domain: input.to.split("@")[1] ?? "unknown",
      subject: input.subject,
      error: String(err),
    });
    return { id: null };
  }
}
