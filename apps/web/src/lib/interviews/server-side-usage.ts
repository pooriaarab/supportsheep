import "server-only";
import { listAllEvents } from "./events-repository";
import type { RealtimeTokens, WriterTokens } from "./cost";

/**
 * Server-authoritative usage aggregation for cost-cap enforcement.
 *
 * Background — F-003 (security audit, 2026-05-21): realtime token usage was
 * being extracted in the browser from OpenAI server-sent WebRTC `response.done`
 * frames and pushed up to the server as `transcript_ai` events with
 * `payload.usage`. The events route stored those numbers verbatim and the
 * `/end` route's cost-cap check summed them. A malicious guest could just
 * report `{ input_tokens: 0, output_tokens: 0 }` for every turn and trivially
 * bypass the workspace `monthlyCostCapUsd` cap (or, conversely, inflate the
 * numbers to DoS new interviews via `cost_cap_exceeded`).
 *
 * Fix: cost-cap accounting must derive from data the server controls. The
 * `/events` route already persists the canonical transcript text (subject to
 * the rate-limit + zod size checks on that route), so we count tokens from
 * those persisted transcripts here. The client cannot underreport: it would
 * have to either not send a transcript at all (in which case the interview
 * produces no article and there is no abuse) or send a fake short transcript
 * (in which case the article it gets back is correspondingly short — i.e.
 * usage proportional to actual transcript volume, which is exactly what we
 * want to bill against the cap).
 *
 * The browser-side `payload.usage` flow is left intact for live UI counters
 * (telemetry only), but it is no longer trusted for billing.
 */

/**
 * Approximate tokens-per-character ratio for OpenAI's realtime tokenisation
 * on English/multilingual mixed text. The widely used heuristic is ~4 chars
 * per token; we use a slightly more conservative 1/3.5 ≈ 0.286 tokens/char
 * here so the cap is *over*-counted rather than under-counted (a workspace
 * tripping the cap a hair early is preferable to a malicious guest racing
 * just under it).
 *
 * Numbers are intentionally conservative — this is the cost-cap floor, not
 * a billing replacement for the upstream provider's authoritative count.
 */
const TOKENS_PER_CHAR = 1 / 3.5;

/**
 * Per-event hard cap on character count before we ignore overflow. Even if a
 * pathological upstream let a 10 MB transcript through the per-event size
 * check, we don't want the cap math to balloon proportionally. 16 KB is well
 * above the realistic per-turn transcript size (~2 KB for a long answer).
 */
const PER_EVENT_TEXT_CAP_CHARS = 16 * 1024;

/**
 * Floor for round-trip overhead: every realtime turn carries audio framing,
 * VAD signalling, and system-prompt re-injection that doesn't appear in the
 * transcript text. Add a small per-turn token floor so a long interview
 * with many short turns isn't undercounted.
 */
const PER_TURN_OVERHEAD_TOKENS = 50;

function estimateTokens(text: string): number {
  if (!text) return 0;
  const clamped = text.length > PER_EVENT_TEXT_CAP_CHARS ? PER_EVENT_TEXT_CAP_CHARS : text.length;
  return Math.ceil(clamped * TOKENS_PER_CHAR);
}

export interface ServerAuthoritativeUsageResult {
  realtime: RealtimeTokens;
  writer: WriterTokens;
}

/**
 * Read transcripts persisted to D1 `interview_events` and compute a
 * server-authoritative token-usage estimate suitable for cost-cap enforcement.
 *
 * - `transcript_user.text` -> realtime input tokens (the user spoke; OpenAI
 *   billed us for transcribing it).
 * - `transcript_ai.text` -> realtime output tokens (the model spoke).
 *
 * Writer tokens are not yet emitted from the server (the writer-worker
 * doesn't currently persist its Anthropic usage to D1 — that's a
 * separate gap), so we return zeros. The cost-cap fix in this commit is
 * scoped to the realtime path, which is where the browser-reported numbers
 * were trusted.
 *
 * the knowledge baseId parameter is required for D1 tenant isolation. Previously this
 * function only took `interviewId`; callers must now supply both.
 */
export async function computeServerAuthoritativeUsage(
  blogId: string,
  interviewId: string,
): Promise<ServerAuthoritativeUsageResult> {
  const events = await listAllEvents(blogId, interviewId, {
    kinds: ["transcript_user", "transcript_ai"],
  });

  const realtime: RealtimeTokens = { input: 0, output: 0 };
  let turnCount = 0;

  for (const ev of events) {
    const payload = ev.payload as { text?: unknown } | undefined;
    const text = typeof payload?.text === "string" ? payload.text : "";
    if (!text) continue;
    const tokens = estimateTokens(text);
    if (ev.kind === "transcript_user") {
      realtime.input += tokens;
      turnCount += 1;
    } else if (ev.kind === "transcript_ai") {
      realtime.output += tokens;
      turnCount += 1;
    }
  }

  // Add per-turn overhead. Floor at zero so a session with no transcripts
  // doesn't get charged for non-existent turns.
  if (turnCount > 0) {
    realtime.input += turnCount * PER_TURN_OVERHEAD_TOKENS;
  }

  return {
    realtime,
    writer: { input: 0, cachedInput: 0, output: 0 },
  };
}

// Re-exported for tests that want to assert the heuristic constants without
// reaching into module internals.
export const __test_constants__ = {
  TOKENS_PER_CHAR,
  PER_EVENT_TEXT_CAP_CHARS,
  PER_TURN_OVERHEAD_TOKENS,
};
