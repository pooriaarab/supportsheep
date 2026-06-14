import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createLogger } from "@/lib/logger";

const log = createLogger("invites:email");
const FROM = process.env.AUTH_EMAIL_FROM ?? "auth@blogbat.com";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface EmailBinding {
  send: (message: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<unknown>;
}

/**
 * Build the public accept-invite URL from BETTER_AUTH_URL (the canonical app
 * origin). Falls back to https://app.blogbat.com when the env var is unset.
 */
export function buildAcceptInviteUrl(token: string): string {
  const base = (process.env.BETTER_AUTH_URL ?? "https://app.blogbat.com").replace(
    /\/+$/,
    "",
  );
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}

/**
 * Send a blog invitation email via the Cloudflare Email Service `EMAIL` binding
 * when present; otherwise log the link (the binding/service is not wired in every
 * environment yet). Never throws on a delivery failure — the invite row is the
 * source of truth and the link is recoverable from the dashboard.
 */
export async function sendInviteEmail({
  inviteId,
  blogId,
  email,
  blogName,
  role,
  acceptUrl,
}: {
  inviteId: string;
  blogId: string;
  email: string;
  blogName: string;
  role: string;
  acceptUrl: string;
}): Promise<void> {
  const env = getCloudflareContext().env as { EMAIL?: EmailBinding };
  const subject = `You're invited to join ${blogName} on BlogBat`;
  const text = `You've been invited to join ${blogName} as a ${role}. Accept your invite: ${acceptUrl}`;
  const html = `<p>You've been invited to join <strong>${escapeHtml(blogName)}</strong> as a ${escapeHtml(role)}.</p><p><a href="${escapeHtml(acceptUrl)}">Accept your invite</a></p>`;

  if (env.EMAIL?.send) {
    try {
      await env.EMAIL.send({ to: email, from: FROM, subject, text, html });
      return;
    } catch (err) {
      // Delivery not configured yet (e.g. blogbat.com not onboarded in CF Email
      // Sending) — never break the invite flow over a delivery failure. Fall
      // through to logging so the link is recoverable.
      // Never log `acceptUrl` — it carries the invite token. Log identifiers
      // that are safe to retain in observability instead.
      log.error("invite email send failed — falling back to logging", {
        inviteId,
        blogId,
        email,
        error: String(err),
      });
    }
  }
  log.info("invite generated (email delivery not configured yet)", {
    inviteId,
    blogId,
    email,
  });
}
