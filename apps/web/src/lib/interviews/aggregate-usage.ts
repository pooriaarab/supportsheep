import "server-only";
import { listAllEvents } from "./events-repository";
import type { RealtimeTokens, WriterTokens } from "./cost";

export interface AggregateUsageResult {
  realtime: RealtimeTokens;
  writer: WriterTokens;
}

/**
 * Aggregate client-supplied token usage from the interview events stored in
 * D1. The event payloads may carry a `usage` block from the OpenAI realtime
 * SDK or from the Anthropic SDK (writer_update); these are used for live UI
 * counters only and are NOT trusted for billing (see server-side-usage.ts /
 * F-003 for the server-authoritative path).
 *
 * The blogId parameter is required for D1 tenant isolation. Callers that
 * previously called `aggregateUsage(interviewId)` should pass the blogId
 * from the interview row; callers inside tests can pass `"default"`.
 */
export async function aggregateUsage(
  blogId: string,
  interviewId: string,
): Promise<AggregateUsageResult> {
  const events = await listAllEvents(blogId, interviewId, {
    kinds: ["transcript_user", "transcript_ai", "writer_update"],
  });

  const realtime: RealtimeTokens = { input: 0, output: 0 };
  const writer: WriterTokens = { input: 0, cachedInput: 0, output: 0 };

  for (const ev of events) {
    const usage = (ev.payload as Record<string, unknown> | undefined)?.usage as
      | { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number }
      | undefined;
    if (!usage) continue;

    if (ev.kind === "transcript_user" || ev.kind === "transcript_ai") {
      realtime.input += usage.input_tokens ?? 0;
      realtime.output += usage.output_tokens ?? 0;
    } else if (ev.kind === "writer_update") {
      const cached = usage.cache_read_input_tokens ?? 0;
      writer.input += (usage.input_tokens ?? 0) - cached;
      writer.cachedInput += cached;
      writer.output += usage.output_tokens ?? 0;
    }
  }

  return { realtime, writer };
}
