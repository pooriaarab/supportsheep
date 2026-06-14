import "server-only";

import type { ToolResult } from "./tools/_types";

/**
 * Per-session defense-in-depth limits applied by the realtime tool
 * dispatcher. These guard against an AI (or a malicious upstream
 * client) that bypasses per-tool `perSessionCap` by hammering many
 * different tools, or by hammering a small number of tools faster
 * than the per-tool caps protect against.
 *
 * Both numbers are intentionally generous — the goal is to backstop
 * a runaway loop, not to throttle a healthy session. A 45-minute
 * conversation that fires a tool every 15 seconds uses ~180 calls;
 * the per-session cap of 200 lets that comfortably through while
 * still catching a model that goes off the rails and tries to fire
 * thousands of edits.
 */
export const MAX_TOOL_CALLS_PER_SESSION = 200;
export const MAX_TOOL_CALLS_PER_MINUTE = 60;

/** Hard byte cap on JSON.stringify(args). A megabyte of "content"
 * forced into a single tool call is always a model bug or an attack
 * — the realtime canvas tools never need more than a few KB.
 */
export const MAX_TOOL_ARGS_BYTES = 32 * 1024;

/**
 * Idempotency cache size. Recent callIds are tracked in a tiny LRU so
 * a network retry that resubmits the same `call_id` is short-circuited
 * to the original ack without invoking the handler twice.
 */
export const IDEMPOTENCY_LRU_SIZE = 256;

/**
 * Window for the per-minute sliding rate limit. Stored as a separate
 * constant so tests can override it cleanly.
 */
export const RATE_WINDOW_MS = 60_000;

interface SessionRateState {
  /** Lifetime call count for this session. */
  totalCount: number;
  /** Timestamps of recent calls, used for the sliding-window check. */
  recentTimestamps: number[];
  /** LRU of callIds we have already seen, mapping to the cached result. */
  idempotencyCache: Map<string, ToolResult>;
}

const sessions = new Map<string, SessionRateState>();

function getSessionRateState(interviewId: string): SessionRateState {
  let state = sessions.get(interviewId);
  if (!state) {
    state = {
      totalCount: 0,
      recentTimestamps: [],
      idempotencyCache: new Map(),
    };
    sessions.set(interviewId, state);
  }
  return state;
}

/** Drop all per-session rate-limit bookkeeping. Called from interview teardown. */
export function clearRateState(interviewId: string): void {
  sessions.delete(interviewId);
}

export interface RateCheckResult {
  allowed: boolean;
  /** When `!allowed`, the reason — used to build the `ToolResult`. */
  reason?: "session_cap" | "minute_cap";
  /** When `!allowed`, milliseconds the caller should wait before retrying. */
  retryAfterMs?: number;
}

/**
 * Check whether a new dispatch is allowed for this session under the
 * global rate limits. Does NOT mutate state — call `recordDispatch`
 * once the dispatch is actually accepted (i.e. after dedupe / idempotency
 * checks short-circuit).
 */
export function checkRateLimit(
  interviewId: string,
  now: number = Date.now(),
): RateCheckResult {
  const state = getSessionRateState(interviewId);

  if (state.totalCount >= MAX_TOOL_CALLS_PER_SESSION) {
    return {
      allowed: false,
      reason: "session_cap",
      // No backoff helps — the session is done. The model should stop
      // dispatching tools and let the interview end naturally.
      retryAfterMs: 0,
    };
  }

  const windowStart = now - RATE_WINDOW_MS;
  // Trim expired timestamps so the array doesn't grow unbounded across
  // a long session. We mutate here defensively — `checkRateLimit` is
  // logically read-only but trimming an unbounded array is a maintenance
  // concern, not a logical state change.
  while (state.recentTimestamps.length > 0 && state.recentTimestamps[0] < windowStart) {
    state.recentTimestamps.shift();
  }

  if (state.recentTimestamps.length >= MAX_TOOL_CALLS_PER_MINUTE) {
    const oldest = state.recentTimestamps[0];
    const retryAfterMs = Math.max(0, RATE_WINDOW_MS - (now - oldest));
    return {
      allowed: false,
      reason: "minute_cap",
      retryAfterMs,
    };
  }

  return { allowed: true };
}

/**
 * Record a successful dispatch in the rate counters. Must be called
 * exactly once per accepted dispatch. Skip for idempotency replays
 * (those are no-ops from the budget perspective). Dedupe cache hits
 * DO count — the dispatcher calls this intentionally so a model
 * can't spam-dedupe to starve other tools' budgets.
 */
export function recordDispatch(interviewId: string, now: number = Date.now()): void {
  const state = getSessionRateState(interviewId);
  state.totalCount += 1;
  state.recentTimestamps.push(now);
}

/**
 * Build a rate-limited `ToolResult`. Centralised here so the dispatcher
 * stays terse and the error message format stays consistent.
 */
export function rateLimitedResult(check: RateCheckResult): ToolResult {
  const isMinute = check.reason === "minute_cap";
  const message = isMinute
    ? `Tool call rate exceeded: more than ${MAX_TOOL_CALLS_PER_MINUTE} calls in the last minute.`
    : `Tool call budget exhausted: session reached the ${MAX_TOOL_CALLS_PER_SESSION}-call cap.`;
  return {
    ok: false,
    category: "rate_limited",
    message,
    retryAfterMs: check.retryAfterMs ?? 0,
  };
}

/**
 * Look up a previously-acked result for this `callId`. Used to make
 * fire-and-forget tool dispatches idempotent under network retry —
 * if the upstream realtime client retransmits the same `call_id` we
 * return the same ack without firing the side-effect a second time.
 *
 * Returns `undefined` when the callId is new.
 */
export function lookupIdempotent(
  interviewId: string,
  callId: string | undefined,
): ToolResult | undefined {
  if (!callId) return undefined;
  const state = getSessionRateState(interviewId);
  const cached = state.idempotencyCache.get(callId);
  if (!cached) return undefined;
  // Refresh recency: re-inserting in a Map moves the key to the tail
  // so `idempotencyCache` behaves as an LRU under iteration order.
  state.idempotencyCache.delete(callId);
  state.idempotencyCache.set(callId, cached);
  return cached;
}

/**
 * Record the result for a `callId` so subsequent retransmissions of
 * the same id return the same ack. Bounded LRU — oldest entries are
 * evicted once the cache hits `IDEMPOTENCY_LRU_SIZE`.
 */
export function rememberIdempotent(
  interviewId: string,
  callId: string | undefined,
  result: ToolResult,
): void {
  if (!callId) return;
  const state = getSessionRateState(interviewId);
  // Refresh-or-insert.
  state.idempotencyCache.delete(callId);
  state.idempotencyCache.set(callId, result);
  while (state.idempotencyCache.size > IDEMPOTENCY_LRU_SIZE) {
    // Delete the oldest insertion (Map iteration order is insertion order).
    const oldestKey = state.idempotencyCache.keys().next().value;
    if (oldestKey === undefined) break;
    state.idempotencyCache.delete(oldestKey);
  }
}

/**
 * Compute the byte length of `JSON.stringify(args)`. Returns `null`
 * when args cannot be serialized (cyclic / non-JSON values). The
 * dispatcher treats `null` as "too large" so a faulty payload can
 * never bypass the size guard.
 */
export function measureArgsBytes(args: unknown): number | null {
  try {
    const serialized = JSON.stringify(args);
    // Note: this is character length, not UTF-8 byte length. For our
    // ASCII-leaning realtime tool args the two are within a few percent
    // and the 32 KB cap leaves ample headroom — we explicitly do not
    // need Buffer.byteLength precision here.
    return typeof serialized === "string" ? serialized.length : null;
  } catch {
    return null;
  }
}
