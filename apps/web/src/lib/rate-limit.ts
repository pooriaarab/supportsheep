/**
 * Per-IP fixed-window rate limiting backed by the D1 `rate_limits` table.
 *
 * Each `<key>:<ip>:<windowStartMs>` bucket is upserted per request: the first
 * request inserts `count = 1`, every subsequent request in the same minute does
 * an atomic `count = count + 1`. Once the post-increment count exceeds the
 * route's `maxPerMinute`, the request is blocked with a `Retry-After`.
 *
 * Fail-open: any DB error returns `{ allowed: true }` and logs a warning. Rate
 * limiting is best-effort and must never take down the public API on a limiter
 * fault.
 */

import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema/rate-limits";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";

const log = createLogger("lib:rate-limit");

/** Fixed window size: 60 seconds. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Default per-route limits (requests per 1-minute window per IP).
 *
 * Keys must match the `key` passed to {@link checkRateLimit} / the
 * `rateLimit.key` option on `createApiHandler`.
 */
export const RATE_LIMITS = {
  /** Anonymous resolution of share-link token + nested calendar lookup. */
  "share-link-by-token": 60,
  /** Consent confirmation: gates expensive realtime/Tavus session minting. */
  "interview-consent": 10,
  /** Event ingestion during a live interview (transcript chunks). */
  "interview-events": 120,
  /** End-of-interview finalisation. */
  "interview-end": 10,
  /** Magic-link send / redeem. */
  "interview-magic-link": 5,
  /**
   * Async-response audio upload. Each call triggers a Whisper API charge
   * billed against our OpenAI account; a low ceiling caps the worst-case
   * cost from a single token over its 30 min TTL (F-002).
   */
  "interview-async-response": 20,
  /**
   * Share-link async-question upload. Authoring users only, but same
   * Whisper-billed shape — keep the cap tight (F-002).
   */
  "interview-async-question": 20,
  /**
   * Gated dev-login endpoint. Only active when `ENABLE_DEV_LOGIN=true`.
   * Tight per-IP cap so a leaked secret cannot be brute-forced or used
   * to flood the auth path.
   */
  "auth-dev-login": 10,
  /**
   * Client-side log ingest. Combined with the per-batch cap of 50 entries
   * enforced in the route handler, this 120 req/min ceiling yields a
   * worst-case throughput of ~100 entries/sec per IP — the spec target.
   */
  "client-logs": 120,
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  /** Configured limit for the window. */
  limit: number;
  /** Approximate remaining requests in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

/**
 * Check + increment the rate-limit counter for `<key>:<ip>` in the current
 * fixed minute window.
 *
 * The upsert is a single atomic statement: `INSERT ... ON CONFLICT(bucket) DO
 * UPDATE SET count = count + 1 RETURNING count`. D1 serialises writes, so the
 * returned count reflects this request's increment and concurrent requests to
 * the same bucket each observe a distinct count — no read-modify-write race.
 *
 * Fails OPEN on any DB error (returns `allowed: true` + logs a warning).
 */
export async function checkRateLimit(input: {
  key: string;
  ip: string;
  maxPerMinute: number;
  now?: number;
}): Promise<RateLimitResult> {
  const now = input.now ?? Date.now();
  const limit = input.maxPerMinute;
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const resetAt = windowStart + RATE_LIMIT_WINDOW_MS;
  const bucket = `${input.key}:${input.ip}:${windowStart}`;

  try {
    const db = getDb();

    const rows = await db
      .insert(rateLimits)
      .values({
        bucket,
        count: 1,
        windowStart,
        expiresAt: resetAt,
      })
      .onConflictDoUpdate({
        target: rateLimits.bucket,
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count });

    const count = rows[0]?.count ?? 1;

    // Best-effort sweep of expired buckets (no cron). Don't block on failure.
    void db
      .delete(rateLimits)
      .where(sql`${rateLimits.expiresAt} < ${now}`)
      .catch(() => undefined);

    if (count > limit) {
      return { allowed: false, limit, remaining: 0, resetAt };
    }
    return { allowed: true, limit, remaining: Math.max(0, limit - count), resetAt };
  } catch (err) {
    // Fail open — never block legitimate traffic on a limiter fault.
    log.warn("rate limit check failed; failing open", {
      key: input.key,
      error: getErrorMessage(err),
    });
    return { allowed: true, limit, remaining: limit, resetAt };
  }
}
