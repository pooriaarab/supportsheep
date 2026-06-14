import "server-only";
import { createLogger } from "@/lib/logger";
import { sendEmail } from "@/lib/email/cloudflare-email";
import {
  isMagicLinkTestCaptureEnabled,
  recordMagicLinkUrl,
} from "./magic-link-test-capture";

const log = createLogger("interviews:magic-link-email");

interface SendInput {
  to: string;
  /** Plaintext share-link token (used to build the redemption URL only). */
  shareLinkToken: string;
  /** Plaintext magic-link bearer token (used to build the redemption URL only). */
  magicLinkToken: string;
  /** Share-link Firestore doc id, for non-reversible log correlation. */
  shareLinkId: string;
  /**
   * SHA-256 hash (hex) of the magic-link token, for non-reversible log
   * correlation. NEVER pass the plaintext token here.
   */
  magicLinkId: string;
}

/**
 * Build the magic-link redemption URL.
 *
 * The URL embeds both the share-link token and the magic-link bearer token —
 * anyone who possesses this URL within the 15-minute TTL can take over the
 * guest interview. Treat it like a password: never log it, never write it to
 * stdout in production, never include it in error reports.
 */
function buildRedemptionUrl(input: SendInput): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://supportsheep.com";
  return `${baseUrl}/api/v1/interviews/magic-link?share=${encodeURIComponent(
    input.shareLinkToken,
  )}&code=${encodeURIComponent(input.magicLinkToken)}`;
}

function recipientDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "unknown";
}

function buildHtml(url: string): string {
  // Minimal, transactional, no tracking. Plain anchor so screen readers and
  // text clients render it correctly. The URL is the entire secret — keep the
  // body short to reduce mis-handling.
  return [
    "<p>You requested a sign-in link to your interview.</p>",
    `<p><a href="${url}">Open my interview</a></p>`,
    "<p>This link is valid for 15 minutes and can only be used once. If you didn't request it, you can ignore this email.</p>",
  ].join("");
}

function buildText(url: string): string {
  return [
    "You requested a sign-in link to your interview.",
    "",
    "Open it here:",
    url,
    "",
    "This link is valid for 15 minutes and can only be used once.",
    "If you didn't request it, you can ignore this email.",
  ].join("\n");
}

export async function sendMagicLinkEmail(input: SendInput): Promise<void> {
  const url = buildRedemptionUrl(input);

  // Test-capture path: e2e suites set INTERVIEW_MAGIC_LINK_TEST_CAPTURE=true
  // (only honoured outside production) so Playwright can follow the link
  // without an outbound mail provider.
  if (isMagicLinkTestCaptureEnabled()) {
    recordMagicLinkUrl(input.to, url);
  }

  // Optional dev convenience: print the full URL ONLY when explicitly opted
  // into via DEBUG_MAGIC_LINKS=true and outside production. This is never on
  // by default.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEBUG_MAGIC_LINKS === "true"
  ) {
    log.debug("Magic link URL (DEBUG_MAGIC_LINKS=true, non-production only)", {
      to: input.to,
      url,
    });
  }

  await sendEmail({
    to: input.to,
    subject: "Your interview sign-in link",
    html: buildHtml(url),
    text: buildText(url),
  });

  // Production-safe log: never includes the URL, the bearer token, or the
  // plaintext recipient email. Only the recipient domain (low PII) and stable
  // non-reversible ids so support can correlate a send with a redemption
  // attempt without exposing the bearer.
  log.info("Magic link email sent", {
    recipientDomain: recipientDomain(input.to),
    shareLinkId: input.shareLinkId,
    magicLinkId: input.magicLinkId.slice(0, 12),
  });
}
