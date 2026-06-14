import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { EmailBinding } from "@/lib/email/cloudflare-email";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth:magic-link");
const FROM = process.env.AUTH_EMAIL_FROM ?? "auth@blogbat.com";

/**
 * Send a Better Auth magic-link email. Uses the Cloudflare Email Service `EMAIL`
 * binding when present; otherwise logs the link. The binding/service is not wired
 * yet, so this currently logs — real delivery is a follow-up (enable Cloudflare
 * Email Service + verify blogbat.com + add the EMAIL binding to wrangler.jsonc).
 */
export async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<void> {
  const env = getCloudflareContext().env as { EMAIL?: EmailBinding };
  if (env.EMAIL?.send) {
    try {
      await env.EMAIL.send({
        to: email,
        from: FROM,
        subject: "Your BlogBat sign-in link",
        text: `Sign in to BlogBat: ${url}`,
        html: `<p>Sign in to BlogBat: <a href="${url}">${url}</a></p>`,
      });
      return;
    } catch (err) {
      // Delivery not configured yet (e.g. blogbat.com not onboarded in CF Email
      // Sending) — never break login over a delivery failure. Fall through to
      // logging the link so the flow still completes.
      log.error("magic link email send failed — falling back to logging", {
        email,
        error: String(err),
      });
    }
  }
  log.info("magic link generated (email delivery not configured yet)", {
    email,
    url,
  });
}
