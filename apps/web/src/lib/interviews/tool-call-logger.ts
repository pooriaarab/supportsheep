import "server-only";

import { randomUUID } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("interviews:tool-call");

/**
 * Structured payload captured by `withToolCallLogging` for every realtime
 * AI tool invocation. The three lifecycle lines (invoked / completed /
 * failed) all share the same `callId` so a gcloud Logs Explorer query
 * (e.g. `jsonPayload.callId="<uuid>"`) can reconstruct the full lifecycle
 * of a single tool call from a single interview.
 */
export interface ToolCallLogInput {
  interviewId: string;
  toolName: string;
  /**
   * The OpenAI realtime `call_id` when the upstream provider supplies it.
   * When absent (or this is a server-side dispatch with no upstream id) we
   * mint a fresh uuid so all three lifecycle lines still correlate.
   */
  callId?: string;
  /**
   * Short, human-readable description of the call arguments — NEVER the
   * raw arguments. The caller is responsible for redacting / summarising
   * any user-typed content (e.g. `"text.length=140 attributedTo='guest'"`).
   * The wrapper does not inspect the underlying args object.
   */
  argsSummary: string;
}

/**
 * Wraps a realtime AI tool dispatch with three structured log lines so
 * gcloud Logs Explorer can reconstruct the full tool-call lifecycle for
 * any interview:
 *
 *   1. `invoked`   (info)  — { interviewId, toolName, callId, argsSummary, status: "invoked" }
 *   2. `completed` (info)  — { interviewId, toolName, callId, durationMs, resultSummary, status: "success" }
 *   3. `failed`    (error) — { interviewId, toolName, callId, durationMs, errorMessage, errorCode, status: "failed" }
 *
 * The wrapper is intentionally side-effect-only for logging — it never
 * transforms the return value or the thrown error of `fn`. Callers can
 * safely wrap any existing tool dispatch without changing tool behaviour.
 *
 * `fn` may return either `void` or a value. If it returns a value whose
 * shape can be safely summarised (e.g. `{ sectionId, ok: true }`) the
 * caller can pass `resultSummarizer` to surface a short string into the
 * `completed` line — again, never raw user content.
 */
export async function withToolCallLogging<T>(
  input: ToolCallLogInput,
  fn: () => T | Promise<T>,
  resultSummarizer?: (result: T) => string,
): Promise<T> {
  const callId = input.callId ?? randomUUID();
  const startedAt = Date.now();

  log.info("Realtime AI tool invoked", {
    interviewId: input.interviewId,
    toolName: input.toolName,
    callId,
    argsSummary: input.argsSummary,
    status: "invoked",
  });

  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    let resultSummary = "ok";
    if (resultSummarizer) {
      try {
        resultSummary = resultSummarizer(result);
      } catch {
        // Never let a faulty summarizer break the tool dispatch — fall back
        // to the generic "ok" marker so we still produce a clean completed
        // line.
        resultSummary = "ok";
      }
    }
    log.info("Realtime AI tool completed", {
      interviewId: input.interviewId,
      toolName: input.toolName,
      callId,
      durationMs,
      resultSummary,
      status: "success",
    });
    return result;
  } catch (err: unknown) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : undefined;
    log.error("Realtime AI tool failed", {
      interviewId: input.interviewId,
      toolName: input.toolName,
      callId,
      durationMs,
      errorMessage,
      errorCode,
      status: "failed",
    });
    throw err;
  }
}

/**
 * Build a short, PII-safe args summary for a realtime AI tool call.
 *
 * Strategy: log shape and size metadata (string lengths, presence of
 * optional fields, enum values) — never the raw user content. Strings
 * longer than 32 chars are reduced to a `length` token so a draft body
 * or transcript chunk never lands in the structured log.
 */
export function summarizeToolArgs(name: string, args: unknown): string {
  if (args === null || args === undefined) return "no_args";
  if (typeof args !== "object") return `arg_type=${typeof args}`;

  const obj = args as Record<string, unknown>;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      parts.push(`${key}=null`);
      continue;
    }
    if (typeof value === "string") {
      // Short identifier-like strings (e.g. sectionId) are safe to log
      // verbatim. Anything longer is reduced to a length token to avoid
      // leaking transcript / article body content into structured logs.
      if (value.length <= 32 && /^[A-Za-z0-9_\-:.]+$/.test(value)) {
        parts.push(`${key}="${value}"`);
      } else {
        parts.push(`${key}.length=${value.length}`);
      }
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      parts.push(`${key}=${value}`);
      continue;
    }
    if (Array.isArray(value)) {
      parts.push(`${key}.count=${value.length}`);
      continue;
    }
    parts.push(`${key}=object`);
  }
  return parts.length > 0 ? `${name}(${parts.join(" ")})` : `${name}()`;
}
