import "server-only";

import { createLogger } from "@/lib/logger";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import { insertToolExecution } from "./tool-executions-repository";
import type { ToolResult } from "./tools/_types";

const log = createLogger("interviews:tool-audit");

/**
 * Persisted audit row for a single realtime tool dispatch. One row
 * per dispatch — success and failure both produce a row so admin
 * analytics queries (`gh /api/v1/admin/interviews/[id]/tools`) can
 * surface per-session tool histograms, durations, and error rates
 * without scanning the full events subcollection.
 *
 * Indexed by `interviewId + timestamp` (defined in firestore.indexes.json).
 */
export interface ToolExecutionRecord {
  interviewId: string;
  toolName: string;
  /** OpenAI realtime call_id when forwarded by the client, else null. */
  callId: string | null;
  /** PII-safe summary string built by `summarizeToolArgs`. */
  argsSummary: string;
  status: "success" | "error";
  /** Set when `status === "error"`. Mirrors `ToolResult.category`. */
  errorKind?: string;
  durationMs: number;
  /**
   * USD attributed to this dispatch when the handler is an LLM-backed
   * fire-and-forget tool (image gen, SEO score, internal links). Sync
   * canvas tools do not incur LLM cost so this is `null` for them.
   */
  costUsd?: number | null;
}

export interface RecordToolExecutionInput {
  interviewId: string;
  toolName: string;
  callId: string | undefined;
  argsSummary: string;
  result: ToolResult;
  durationMs: number;
  costUsd?: number | null;
}

/**
 * Persist a single tool-execution audit row. Failures inside this
 * function are swallowed and logged — the dispatcher must never fail
 * a tool call just because the audit log write failed.
 */
export async function recordToolExecution(
  input: RecordToolExecutionInput,
): Promise<void> {
  try {
    const status: "success" | "error" = input.result.ok ? "success" : "error";
    const record: ToolExecutionRecord = {
      interviewId: input.interviewId,
      toolName: input.toolName,
      callId: input.callId ?? null,
      argsSummary: input.argsSummary,
      status,
      durationMs: input.durationMs,
      costUsd: input.costUsd ?? null,
    };
    if (!input.result.ok) {
      record.errorKind = input.result.category;
    }
    await insertToolExecution(DEFAULT_blog_id, record);
  } catch (err: unknown) {
    log.warn("tool-audit:write-failed", {
      interviewId: input.interviewId,
      toolName: input.toolName,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
