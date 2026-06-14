import "server-only";

import type { DrizzleD1Database } from "drizzle-orm/d1";

import type * as schema from "@/db/schema";
import { createLogger } from "@/lib/logger";

import {
  getCustomHostname,
  type CustomHostnameResult,
} from "./cloudflare-saas";
import {
  getDomainGuidance,
  type DomainGuidance,
} from "./domain-status-guidance";
import {
  listPendingDomains,
  touchDomainChecked,
  updateBlogDomainStatus,
  type CustomDomainStatus,
  type PendingDomainRow,
} from "./repository";
import {
  sendDomainActivatedEmail,
  sendDomainFailedEmail,
} from "./send-domain-status-email";

type DB = DrizzleD1Database<typeof schema>;

const log = createLogger("domains:refresh");

/** How long a domain may stay pending before the poller marks it failed. */
const DEFAULT_PENDING_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/** Map guidance state → our stored verification status. */
function statusFromGuidance(guidance: DomainGuidance): CustomDomainStatus {
  if (guidance.state === "active") return "active";
  if (guidance.state === "failed") return "failed";
  return "pending";
}

export interface RefreshOutcome {
  /** The status after this refresh. */
  status: CustomDomainStatus;
  /** The guidance computed from Cloudflare. */
  guidance: DomainGuidance;
  /** The normalized Cloudflare hostname result. */
  cf: CustomHostnameResult;
  /** Whether the status changed from what was stored. */
  changed: boolean;
}

interface RefreshInput {
  blogId: string;
  hostnameId: string;
  /** The status currently stored (used to detect a transition). */
  currentStatus: CustomDomainStatus;
  /** The status we last emailed about, for notification dedupe. */
  notifiedStatus: string | null;
  /** When the domain first became pending (epoch ms), for the failure timeout. */
  pendingSince: number | null;
  /** Override the pending→failed timeout (tests). */
  pendingTimeoutMs?: number;
  /** Inject "now" for tests. */
  now?: number;
}

/**
 * Refresh one domain's status from Cloudflare, persist any transition, and send
 * a deduped notification email on a real transition. Shared by the on-GET
 * refresh and the background poller so both behave identically.
 *
 * Notification dedupe: an email is sent only when the *destination* status
 * (active/failed) differs from `notifiedStatus`. On send, `notifiedStatus` is
 * advanced so the same transition never emails twice — even if both the GET
 * path and the poller observe it.
 */
export async function refreshDomainStatus(
  input: RefreshInput,
  db: DB,
): Promise<RefreshOutcome> {
  const now = input.now ?? Date.now();
  const timeout = input.pendingTimeoutMs ?? DEFAULT_PENDING_TIMEOUT_MS;

  const cf = await getCustomHostname(input.hostnameId);
  let guidance = getDomainGuidance(cf);
  let nextStatus = statusFromGuidance(guidance);

  // Age out a domain that has been pending too long: treat as failed with a
  // clear reason so the owner stops waiting on a misconfiguration.
  if (
    nextStatus === "pending" &&
    input.pendingSince !== null &&
    now - input.pendingSince > timeout
  ) {
    nextStatus = "failed";
    guidance = {
      state: "failed",
      userMessage:
        "Your domain was not verified within 24 hours, so verification timed out.",
      fixHint:
        guidance.fixHint ??
        "Confirm the DNS records are correct, then remove and re-add the domain.",
    };
  }

  const changed = nextStatus !== input.currentStatus;

  // Decide whether to notify: only on reaching a terminal state we have not
  // already emailed about.
  const shouldNotify =
    (nextStatus === "active" || nextStatus === "failed") &&
    input.notifiedStatus !== nextStatus;

  await updateBlogDomainStatus(
    input.blogId,
    nextStatus,
    {
      verifiedAt: nextStatus === "active" ? now : null,
      failureReason: nextStatus === "failed" ? guidance.userMessage : null,
      notifiedStatus: shouldNotify ? nextStatus : undefined,
      lastCheckedAt: now,
    },
    db,
  );

  if (shouldNotify) {
    try {
      if (nextStatus === "active") {
        await sendDomainActivatedEmail(input.blogId, cf.hostname);
      } else {
        await sendDomainFailedEmail(input.blogId, cf, guidance);
      }
    } catch (err) {
      // Never let email break the refresh — the status is already persisted.
      log.error("domain transition email failed", {
        blogId: input.blogId,
        status: nextStatus,
        error: String(err),
      });
    }
  }

  return { status: nextStatus, guidance, cf, changed };
}

export interface BatchRefreshResult {
  scanned: number;
  checked: number;
  activated: number;
  failed: number;
}

/**
 * Batch-refresh every pending domain. Applies age-based backoff: a domain
 * checked within `minRecheckMs` is skipped this run (recently-added domains are
 * polled every run; stale ones less often). Errors on a single domain are
 * logged and skipped so one bad row never stalls the batch.
 */
export async function refreshAllPendingDomains(
  opts: {
    now?: number;
    minRecheckMs?: number;
    pendingTimeoutMs?: number;
    maxPerRun?: number;
  } = {},
  db: DB,
): Promise<BatchRefreshResult> {
  const now = opts.now ?? Date.now();
  // A domain checked < 1h ago is rechecked every run; older rows are still
  // rechecked (they sort first), so this only throttles a row checked seconds
  // ago by a concurrent GET. Keep it small + simple.
  const minRecheckMs = opts.minRecheckMs ?? 60 * 1000;
  const maxPerRun = opts.maxPerRun ?? 200;

  const pending = await listPendingDomains(db);
  const result: BatchRefreshResult = {
    scanned: pending.length,
    checked: 0,
    activated: 0,
    failed: 0,
  };

  let processed = 0;
  for (const row of pending) {
    if (processed >= maxPerRun) break;
    if (row.lastCheckedAt !== null && now - row.lastCheckedAt < minRecheckMs) {
      continue;
    }
    processed += 1;

    try {
      const outcome = await refreshOnePending(row, { now, ...opts }, db);
      result.checked += 1;
      if (outcome.status === "active") result.activated += 1;
      if (outcome.status === "failed") result.failed += 1;
    } catch (err) {
      log.error("pending domain refresh failed", {
        blogId: row.blogId,
        error: String(err),
      });
      // Stamp the check time anyway so a permanently-erroring row backs off.
      try {
        await touchDomainChecked(row.blogId, now, db);
      } catch {
        // ignore secondary failure
      }
    }
  }

  return result;
}

/** Refresh a single pending row using its stored verifiedAt as pendingSince. */
function refreshOnePending(
  row: PendingDomainRow,
  opts: { now?: number; pendingTimeoutMs?: number },
  db: DB,
): Promise<RefreshOutcome> {
  return refreshDomainStatus(
    {
      blogId: row.blogId,
      hostnameId: row.hostnameId,
      currentStatus: row.status,
      notifiedStatus: row.notifiedStatus,
      // No created-at on the pending row; use lastCheckedAt as a coarse floor
      // for the timeout (a domain that has never been checked is young).
      pendingSince: row.lastCheckedAt,
      pendingTimeoutMs: opts.pendingTimeoutMs,
      now: opts.now,
    },
    db,
  );
}
