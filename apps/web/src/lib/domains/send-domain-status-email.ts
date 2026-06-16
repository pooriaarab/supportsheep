import "server-only";

import { sendEmail } from "@/lib/email/cloudflare-email";
import { listBlogMembers } from "@/lib/tenancy/members";

import type { CustomHostnameResult } from "./cloudflare-saas";
import type { DomainGuidance } from "./domain-status-guidance";

/** Roles that receive custom-domain status notifications. */
const NOTIFY_ROLES = new Set(["owner", "admin"]);

/** A DNS record row rendered in the failure email's table. */
interface DnsRow {
  type: string;
  name: string;
  value: string;
  /** Whether Cloudflare considers this record satisfied. */
  ok: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Owner/admin email addresses for a blog. Deduped. */
async function notifyRecipients(blogId: string): Promise<string[]> {
  const members = await listBlogMembers(blogId);
  const emails = members
    .filter((m) => NOTIFY_ROLES.has(m.role) && m.email)
    .map((m) => m.email);
  return Array.from(new Set(emails));
}

/**
 * Send the same email to every recipient via the Cloudflare Email Service
 * `EMAIL` binding (`@/lib/email/cloudflare-email`). `sendEmail` is best-effort
 * and never throws, so a delivery failure never breaks the domain status flow.
 */
async function sendToAll(
  recipients: string[],
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  for (const to of recipients) {
    await sendEmail({ to, subject, text, html });
  }
}

/**
 * Email owners/admins that their custom domain is now live. Best-effort: any
 * delivery failure is logged and swallowed so the status flow never breaks.
 */
export async function sendDomainActivatedEmail(
  blogId: string,
  domain: string,
): Promise<void> {
  const recipients = await notifyRecipients(blogId);
  if (recipients.length === 0) return;

  const url = `https://${domain}`;
  const subject = `${domain} is now live 🎉`;
  const text = [
    `Your custom domain ${domain} is verified and live.`,
    ``,
    `Visit your knowledge base: ${url}`,
  ].join("\n");
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 12px">${escapeHtml(domain)} is now live 🎉</h2>
      <p>Your custom domain is verified and serving over HTTPS.</p>
      <p><a href="${escapeHtml(url)}">${escapeHtml(domain)}</a></p>
    </div>`;

  await sendToAll(recipients, subject, html, text);
}

/**
 * Email owners/admins that their custom domain failed verification, with a
 * table of the DNS records they need and which are missing/mismatched, plus the
 * plain-English reason + fix hint. Best-effort.
 */
export async function sendDomainFailedEmail(
  blogId: string,
  cf: CustomHostnameResult,
  guidance: DomainGuidance,
): Promise<void> {
  const recipients = await notifyRecipients(blogId);
  if (recipients.length === 0) return;

  // The required records: the routing CNAME, plus the ownership-verification
  // record when Cloudflare requires one. A record is "ok" only when Cloudflare
  // reports no outstanding verification/SSL errors for the hostname.
  const recordsSatisfied = guidance.state === "active";
  const rows: DnsRow[] = [
    {
      type: "CNAME",
      name: cf.hostname,
      value: cf.dcvTarget,
      ok: recordsSatisfied,
    },
  ];
  if (cf.ownershipVerification) {
    rows.push({
      type: cf.ownershipVerification.type.toUpperCase(),
      name: cf.ownershipVerification.name,
      value: cf.ownershipVerification.value,
      ok: recordsSatisfied,
    });
  }

  const subject = `Action needed: ${cf.hostname} could not be verified`;

  const textRows = rows
    .map(
      (r) =>
        `${r.ok ? "[OK]" : "[MISSING]"} ${r.type}  ${r.name}  ->  ${r.value}`,
    )
    .join("\n");
  const text = [
    `We could not verify your custom domain ${cf.hostname}.`,
    ``,
    guidance.userMessage,
    guidance.fixHint ? `\nHow to fix: ${guidance.fixHint}` : "",
    ``,
    `Required DNS records:`,
    textRows,
  ].join("\n");

  const htmlRows = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #e5e7eb">${r.ok ? "✅" : "❌"}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(r.type)}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb"><code>${escapeHtml(r.name)}</code></td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb"><code>${escapeHtml(r.value)}</code></td>
      </tr>`,
    )
    .join("");
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 12px">${escapeHtml(cf.hostname)} could not be verified</h2>
      <p>${escapeHtml(guidance.userMessage)}</p>
      ${guidance.fixHint ? `<p><strong>How to fix:</strong> ${escapeHtml(guidance.fixHint)}</p>` : ""}
      <h3 style="margin:16px 0 8px">Required DNS records</h3>
      <table style="border-collapse:collapse;font-size:13px">
        <thead>
          <tr>
            <th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">Status</th>
            <th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">Type</th>
            <th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">Name</th>
            <th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">Value</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </div>`;

  await sendToAll(recipients, subject, html, text);
}
