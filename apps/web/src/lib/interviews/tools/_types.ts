import type { z } from "zod";
import type { Logger } from "@/lib/logger";
import type { CanvasState, WriterWorker } from "../writer-worker";

/**
 * High-level category groupings from the realtime tool catalog
 * (`docs/plans/2026-05-21-realtime-tool-catalog-design.md`). Each tool
 * file declares the category it belongs to so the system prompt and
 * future per-workspace allowlists can filter by group.
 */
export type ToolCategory =
  | "title-meta"
  | "section"
  | "paragraph"
  | "marks"
  | "lists"
  | "blocks"
  | "embeds"
  | "images"
  | "seo"
  | "read"
  | "lifecycle";

/**
 * How the tool's result is delivered back to the realtime model:
 *
 * - `"sync"`: the handler resolves before the tool result is returned
 *   to the LLM. Use for canvas mutations and reads that complete in
 *   < 200 ms.
 * - `"fire-and-forget"`: the handler returns an immediate ack and the
 *   real work runs in the background. Used by Phase 5 (images, SEO).
 *   Phase 1 only ships sync tools — the discriminant exists today so
 *   later phases can add fire-and-forget tools without changing the
 *   registry API.
 */
export type ToolExecutionMode = "sync" | "fire-and-forget";

/**
 * Defensive runtime context passed to every tool handler. Each tool
 * receives a reference to the live `WriterWorker` and helpers for
 * inspecting/mutating canvas state — never raw Firestore handles.
 *
 * `getCurrentCanvas` returns the same defensive deep copy
 * `WriterWorker.getCanvas()` produces.
 */
export interface ToolContext {
  interviewId: string;
  worker: WriterWorker;
  logger: Logger;
  getCurrentCanvas(): CanvasState;
}

/**
 * Structured result returned to the realtime model. Modelled after
 * the admin's `formatForLLM(...)` discriminant: errors carry a
 * machine-readable category so the model can decide between
 * "retry with different args" (validation) vs "stop trying"
 * (permanent). `data` and `summary` on the success branch are
 * deliberately broad — each tool decides what payload best
 * informs the next conversation turn.
 *
 * Error categories:
 * - `validation` — args failed Zod parsing (model should retry with fix)
 * - `not-found` — referenced entity (e.g. paragraphId) does not exist
 * - `budget` — per-tool perSessionCap hit
 * - `dedupe` — duplicate arg-hash inside dedupe window (cached result returned via `ok: true`)
 * - `rate_limited` — global per-session or per-minute cap hit (model should slow down; `retryAfterMs` set)
 * - `args_too_large` — JSON-serialized args exceeded the dispatcher byte cap
 * - `cost_cap_exceeded` — workspace monthlyCostCapUsd would be breached by this call
 * - `upstream_error` — fire-and-forget tool surfaced a 429/5xx from OpenAI/Anthropic/Tavus
 * - `permanent` — anything else (handler threw, unknown tool, …)
 */
export type ToolResult =
  | { ok: true; data?: unknown; summary?: string }
  | {
      ok: false;
      category:
        | "validation"
        | "not-found"
        | "budget"
        | "dedupe"
        | "rate_limited"
        | "args_too_large"
        | "cost_cap_exceeded"
        | "upstream_error"
        | "permanent";
      message: string;
      /**
       * Optional retry hint for transient errors (`rate_limited`,
       * `upstream_error`). The model can use this to back off rather than
       * immediately re-dispatching the same call.
       */
      retryAfterMs?: number;
    };

/**
 * Per-tool definition. Every file under `tools/` (except `_*.ts` and
 * `*.test.ts`) must `export default` a value that satisfies this
 * interface. The barrel/dispatcher (`tools/index.ts`) auto-loads
 * every such file and builds the dispatch table at import time.
 *
 * - `name` must be globally unique (snake_case to match OpenAI Realtime
 *   conventions). The dispatcher logs a warning if it sees a duplicate.
 * - `argsSchema` is a Zod schema. Validation runs before `handler`;
 *   a validation failure returns `{ ok: false, category: "validation" }`
 *   without invoking the handler. The schema is also used to derive
 *   the JSON Schema passed to OpenAI's session config.
 * - `perSessionCap` is an upper bound on how many times this tool can
 *   fire within one interview session. Default unlimited.
 * - `dedupe` declares an argument-hash window. A second call inside
 *   the window with the same key returns a cached result rather than
 *   invoking the handler twice. Default no dedupe.
 */
export interface Tool<TArgs = unknown> {
  name: string;
  description: string;
  category: ToolCategory;
  argsSchema: z.ZodType<TArgs>;
  executionMode: ToolExecutionMode;
  /** Optional per-session call cap. Default unlimited. */
  perSessionCap?: number;
  /**
   * Optional dedupe configuration. When set, two calls whose args
   * produce the same key within `windowMs` are coalesced — the
   * second call returns the first call's cached result.
   */
  dedupe?: {
    keyFromArgs(args: TArgs): string;
    windowMs: number;
  };
  /**
   * When `true`, the dispatcher checks the workspace monthly cost cap
   * before invoking the handler. Tools that trigger downstream LLM
   * calls (image gen, SEO score, internal-link suggestions, …) MUST
   * set this so a runaway interview can never push the workspace past
   * its `monthlyCostCapUsd`. Sync canvas tools (paragraph CRUD,
   * heading, etc.) leave this unset.
   */
  incursLlmCost?: boolean;
  handler(args: TArgs, ctx: ToolContext): Promise<ToolResult> | ToolResult;
}
