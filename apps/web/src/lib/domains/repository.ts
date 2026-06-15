import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { blogs } from "@/db/schema/tenancy";

import { toAsciiHostname } from "./punycode";

type DB = DrizzleD1Database<typeof schema>;

/** Custom-domain verification states stored on `blogs.customDomainStatus`. */
export type CustomDomainStatus = "pending" | "active" | "failed";

/** The custom-domain fields of a blog, as exposed to the dashboard. */
export interface BlogDomain {
  domain: string | null;
  status: CustomDomainStatus | null;
  hostnameId: string | null;
  verifiedAt: number | null;
  lastCheckedAt: number | null;
  notifiedStatus: string | null;
  failureReason: string | null;
}

const ROOT_DOMAIN = "supportsheep.com";

// A DNS hostname: one or more dot-separated labels (letters, digits, hyphens;
// no leading/trailing hyphen per label) ending in a 2+ char alpha TLD.
const HOSTNAME_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export type DomainValidation =
  | { ok: true; domain: string }
  | { ok: false; reason: "invalid_format" | "reserved" };

/**
 * Validate and normalize a custom domain. The input is lowercased, trimmed, and
 * IDNA/punycode-encoded to ASCII (so `münchen.de` → `xn--mnchen-3ya.de`); it
 * must be a real hostname and must NOT be the platform apex or any
 * `*.supportsheep.com` subdomain (those are served by slug routing, not custom
 * hostnames).
 */
export function validateCustomDomain(raw: string): DomainValidation {
  const domain = toAsciiHostname(raw);
  if (!domain || domain.length > 253 || !HOSTNAME_PATTERN.test(domain)) {
    return { ok: false, reason: "invalid_format" };
  }
  if (domain === ROOT_DOMAIN || domain.endsWith(`.${ROOT_DOMAIN}`)) {
    return { ok: false, reason: "reserved" };
  }
  return { ok: true, domain };
}

/**
 * Whether a hostname is a bare apex (registrable domain with no subdomain),
 * e.g. `example.com` or `example.co.uk`. Used to surface a "www is separate"
 * note. Heuristic: treats a 2-label host as apex; for a 3-label host whose
 * last two labels look like a known multi-part public suffix
 * (`co.uk`, `com.au`, …) it is also apex. Pure and dependency-free.
 */
export function isApexDomain(domain: string): boolean {
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.length === 2) return true;
  if (labels.length === 3) {
    const secondLevel = labels[1];
    const multiPartSeconds = new Set([
      "co",
      "com",
      "org",
      "net",
      "gov",
      "edu",
      "ac",
    ]);
    return multiPartSeconds.has(secondLevel);
  }
  return false;
}

/** The `www.` counterpart of an apex, or null when `domain` already has a subdomain. */
export function wwwCounterpart(domain: string): string | null {
  return isApexDomain(domain) ? `www.${domain}` : null;
}

/** Read the custom-domain fields for a blog, or null when the knowledge base is unknown. */
export async function getBlogDomain(
  blogId: string,
  db: DB = getDb(),
): Promise<BlogDomain | null> {
  const rows = await db
    .select({
      domain: blogs.customDomain,
      status: blogs.customDomainStatus,
      hostnameId: blogs.customDomainHostnameId,
      verifiedAt: blogs.customDomainVerifiedAt,
      lastCheckedAt: blogs.customDomainLastCheckedAt,
      notifiedStatus: blogs.customDomainNotifiedStatus,
      failureReason: blogs.customDomainFailureReason,
    })
    .from(blogs)
    .where(eq(blogs.id, blogId))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    domain: row.domain,
    status: (row.status as CustomDomainStatus | null) ?? null,
    hostnameId: row.hostnameId,
    verifiedAt: row.verifiedAt,
    lastCheckedAt: row.lastCheckedAt,
    notifiedStatus: row.notifiedStatus,
    failureReason: row.failureReason,
  };
}

/**
 * True when no OTHER blog already claims this (lowercased) domain. The unique
 * index on `custom_domain` is the real guard; this is the friendly pre-check.
 */
export async function customDomainAvailable(
  domain: string,
  blogId: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .select({ id: blogs.id })
    .from(blogs)
    .where(
      and(eq(blogs.customDomain, domain.toLowerCase()), ne(blogs.id, blogId)),
    )
    .limit(1);
  return rows.length === 0;
}

/** Persist a newly-provisioned (pending) custom domain on a blog. */
export async function setBlogDomain(
  blogId: string,
  input: { domain: string; hostnameId: string },
  db: DB = getDb(),
): Promise<void> {
  await db
    .update(blogs)
    .set({
      customDomain: input.domain.toLowerCase(),
      customDomainHostnameId: input.hostnameId,
      customDomainStatus: "pending",
      customDomainVerifiedAt: null,
      customDomainLastCheckedAt: null,
      customDomainNotifiedStatus: null,
      customDomainFailureReason: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(blogs.id, blogId));
}

/**
 * Update a blog's custom-domain verification status. When transitioning to
 * "active" for the first time, stamps `customDomainVerifiedAt`; when failed,
 * stores the plain-English `failureReason` (cleared otherwise). Optionally
 * records that a transition email was sent (`notifiedStatus`) and stamps the
 * last Cloudflare check time, so the poller can dedupe and back off.
 */
export async function updateBlogDomainStatus(
  blogId: string,
  status: CustomDomainStatus,
  opts: {
    verifiedAt?: number | null;
    failureReason?: string | null;
    notifiedStatus?: string | null;
    lastCheckedAt?: number | null;
  } = {},
  db: DB = getDb(),
): Promise<void> {
  const update: Record<string, unknown> = {
    customDomainStatus: status,
    customDomainVerifiedAt:
      status === "active" ? (opts.verifiedAt ?? Date.now()) : null,
    customDomainFailureReason:
      status === "failed" ? (opts.failureReason ?? null) : null,
    updatedAt: new Date().toISOString(),
  };
  if (opts.notifiedStatus !== undefined) {
    update.customDomainNotifiedStatus = opts.notifiedStatus;
  }
  if (opts.lastCheckedAt !== undefined) {
    update.customDomainLastCheckedAt = opts.lastCheckedAt;
  }
  await db.update(blogs).set(update).where(eq(blogs.id, blogId));
}

/** Stamp the last Cloudflare check time for a domain (poller backoff). */
export async function touchDomainChecked(
  blogId: string,
  at: number,
  db: DB = getDb(),
): Promise<void> {
  await db
    .update(blogs)
    .set({ customDomainLastCheckedAt: at })
    .where(eq(blogs.id, blogId));
}

/** Record that a transition email was sent for `status` (notification dedupe). */
export async function markDomainNotified(
  blogId: string,
  status: string,
  db: DB = getDb(),
): Promise<void> {
  await db
    .update(blogs)
    .set({ customDomainNotifiedStatus: status })
    .where(eq(blogs.id, blogId));
}

/** A pending custom-domain row the poller must advance. */
export interface PendingDomainRow {
  blogId: string;
  domain: string;
  hostnameId: string;
  status: CustomDomainStatus;
  lastCheckedAt: number | null;
  verifiedAt: number | null;
  notifiedStatus: string | null;
}

/**
 * List all blogs whose custom domain is still `pending` — the work set for the
 * background poller. Ordered by least-recently-checked first (nulls first) so a
 * single run makes progress even under a per-run cap.
 */
export async function listPendingDomains(
  db: DB = getDb(),
): Promise<PendingDomainRow[]> {
  const rows = await db
    .select({
      blogId: blogs.id,
      domain: blogs.customDomain,
      hostnameId: blogs.customDomainHostnameId,
      status: blogs.customDomainStatus,
      lastCheckedAt: blogs.customDomainLastCheckedAt,
      verifiedAt: blogs.customDomainVerifiedAt,
      notifiedStatus: blogs.customDomainNotifiedStatus,
    })
    .from(blogs)
    .where(eq(blogs.customDomainStatus, "pending"))
    .orderBy(asc(blogs.customDomainLastCheckedAt));

  return rows
    .filter(
      (r): r is typeof r & { domain: string; hostnameId: string } =>
        !!r.domain && !!r.hostnameId,
    )
    .map((r) => ({
      blogId: r.blogId,
      domain: r.domain,
      hostnameId: r.hostnameId,
      status: "pending" as const,
      lastCheckedAt: r.lastCheckedAt,
      verifiedAt: r.verifiedAt,
      notifiedStatus: r.notifiedStatus,
    }));
}

/** Clear all custom-domain fields on a blog (after removal). */
export async function clearBlogDomain(
  blogId: string,
  db: DB = getDb(),
): Promise<void> {
  await db
    .update(blogs)
    .set({
      customDomain: null,
      customDomainHostnameId: null,
      customDomainStatus: null,
      customDomainVerifiedAt: null,
      customDomainLastCheckedAt: null,
      customDomainNotifiedStatus: null,
      customDomainFailureReason: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(blogs.id, blogId));
}
