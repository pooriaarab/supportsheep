import "server-only";

import { z } from "zod";
import { getBlogConfig } from "@/lib/blog-config";
import { appendEvents } from "@/lib/interviews/events-repository";
import { sumMonthlyInterviewCostUsd } from "@/lib/interviews/interviews-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { createLogger } from "@/lib/logger";
import {
  emitToolInFlightEvent,
  emitToolResultEvent,
} from "./_narration-events";
import type { WriterWorker } from "../writer-worker";
import {
  summarizeToolArgs,
  withToolCallLogging,
} from "../tool-call-logger";
import { recordToolExecution } from "../tool-audit";
import {
  checkRateLimit,
  clearRateState,
  lookupIdempotent,
  MAX_TOOL_ARGS_BYTES,
  measureArgsBytes,
  rateLimitedResult,
  recordDispatch,
  rememberIdempotent,
} from "../tool-rate-limit";
import { clearImageBudget } from "../image-budget";
import type {
  Tool,
  ToolCategory,
  ToolContext,
  ToolExecutionMode,
  ToolResult,
} from "./_types";

// Phase 1 — 5 existing scaffold tools, ported verbatim from
// WriterWorker.applyToolCall so behaviour is unchanged.
import addHeading from "./add-heading";
import addBullet from "./add-bullet";
import startParagraph from "./start-paragraph";
import addQuote from "./add-quote";
import finalizeSection from "./finalize-section";
// Phase 2 (paragraphs) — id-addressable paragraph CRUD so the realtime
// model can edit prose without a full writer-worker refinement cycle.
import insertParagraph from "./insert-paragraph";
import deleteParagraph from "./delete-paragraph";
import moveParagraph from "./move-paragraph";
import replaceText from "./replace-text";
import splitParagraph from "./split-paragraph";
import joinParagraphs from "./join-paragraphs";
import setAlignment from "./set-alignment";
// Phase 4 — block + embed tools. Blocks add rich content beyond
// bullets/paragraphs/quotes (callouts, code blocks, tables, …);
// embeds funnel through a single generic TipTap node with a `kind`
// discriminator (see lib/tiptap/nodes/embed.ts). Per-session caps
// guard against the AI spamming the canvas with decorative blocks
// (30) or external embeds (10).
import insertBlockquote from "./insert-blockquote";
import insertCallout from "./insert-callout";
import insertCodeBlock from "./insert-code-block";
import insertDivider from "./insert-divider";
import insertTable from "./insert-table";
import embedCodepen from "./embed-codepen";
import embedGist from "./embed-gist";
import embedIframe from "./embed-iframe";
import embedLoom from "./embed-loom";
import embedTweet from "./embed-tweet";
import embedYoutube from "./embed-youtube";
// Phase 6 — 3 read tools so the AI can introspect the canvas
// before destructive edits.
import getSection from "./get-section";
import getCurrentState from "./get-current-state";
import getWordCount from "./get-word-count";
// Phase 3 — 8 marks + 6 list tools. Marks store inline formatting as
// markdown-style escapes inside the existing paragraph strings; lists
// live in a new `CanvasSection.lists` field (see writer-worker.ts).
import addListItem from "./add-list-item";
import applyBold from "./apply-bold";
import applyCode from "./apply-code";
import applyHeadingLevel from "./apply-heading-level";
import applyHighlight from "./apply-highlight";
import applyItalic from "./apply-italic";
import applyLink from "./apply-link";
import applyStrike from "./apply-strike";
import applySubscript from "./apply-subscript";
import applySuperscript from "./apply-superscript";
import applyUnderline from "./apply-underline";
import clearFormatting from "./clear-formatting";
import completeListItem from "./complete-list-item";
import convertToBulletList from "./convert-to-bullet-list";
import convertToChecklist from "./convert-to-checklist";
import convertToNumberedList from "./convert-to-numbered-list";
import nestListItem from "./nest-list-item";
// Phase 5 — images (5 tools) + SEO (6 tools). 7 are fire-and-forget
// so the realtime turn doesn't stall on slow upstreams; 4 are sync.
import addInternalLink from "./add-internal-link";
import insertInlineImage from "./insert-inline-image";
import insertVideo from "./insert-video";
import regenerateFeaturedImage from "./regenerate-featured-image";
import replaceInlineImage from "./replace-inline-image";
import requestFeaturedImage from "./request-featured-image";
import requestSeoScore from "./request-seo-score";
import setAltText from "./set-alt-text";
import setCategories from "./set-categories";
import setKeywords from "./set-keywords";
import setTags from "./set-tags";
import suggestInternalLinks from "./suggest-internal-links";
// Phase 2 — title/meta + section ops (10 tools). Imports listed in
// alphabetical order by tool name to minimise conflict resolution
// against other Wave 5 batches landing in parallel.
import deleteSection from "./delete-section";
import insertSection from "./insert-section";
import mergeSections from "./merge-sections";
import moveSection from "./move-section";
import renameSection from "./rename-section";
import setHeadingLevel from "./set-heading-level";
import setSeoMeta from "./set-seo-meta";
import setSlug from "./set-slug";
import setSubtitle from "./set-subtitle";
import setTitle from "./set-title";
// Lifecycle — guest-driven "end the interview" signal. The handler is a
// no-op ack; the actual /end POST runs client-side via the realtime
// data-channel `onToolCall` intercept so the AI can finish the session
// without the user having to click End Session.
import endInterview from "./end-interview";

export type { Tool, ToolCategory, ToolContext, ToolResult } from "./_types";

const log = createLogger("interviews:tools");

/**
 * The full tool catalog. One entry per file under `tools/`. Adding a
 * new tool is a two-step change: drop a new file in this directory
 * exporting a default `Tool`, then add a single import + entry here.
 *
 * The admin system uses the same `ALL_PROVIDERS` barrel pattern at scale
 * (~70 providers) — explicit imports keep the dispatch table
 * statically analysable and avoid Node-vs-bundler edge cases that
 * an `fs.readdirSync` loop would hit in App Router production
 * builds.
 *
 * Duplicate names log a warning and the first registration wins —
 * mirrors the admin registry pattern.
 */
const ALL_TOOLS: Tool[] = [
  addHeading,
  addBullet,
  startParagraph,
  addQuote,
  finalizeSection,
  // Phase 2 — paragraph tools (alphabetical within block).
  deleteParagraph,
  insertParagraph,
  joinParagraphs,
  moveParagraph,
  replaceText,
  setAlignment,
  splitParagraph,
  // Phase 4 — block + embed tools (alphabetical within block).
  embedCodepen,
  embedGist,
  embedIframe,
  embedLoom,
  embedTweet,
  embedYoutube,
  insertBlockquote,
  insertCallout,
  insertCodeBlock,
  insertDivider,
  insertTable,
  // Phase 6 — read tools.
  getSection,
  getCurrentState,
  getWordCount,
  // Phase 3 — marks (8) + lists (6), alphabetical.
  addListItem,
  applyBold,
  applyCode,
  applyHeadingLevel,
  applyHighlight,
  applyItalic,
  applyLink,
  applyStrike,
  applySubscript,
  applySuperscript,
  applyUnderline,
  clearFormatting,
  completeListItem,
  convertToBulletList,
  convertToChecklist,
  convertToNumberedList,
  nestListItem,
  // Phase 5 — alphabetical block.
  addInternalLink,
  insertInlineImage,
  insertVideo,
  regenerateFeaturedImage,
  replaceInlineImage,
  requestFeaturedImage,
  requestSeoScore,
  setAltText,
  setCategories,
  setKeywords,
  setTags,
  suggestInternalLinks,
  // Phase 2 — title/meta + section ops, alphabetical by tool name to
  // minimise merge conflicts with the other Wave 5 batches.
  deleteSection,
  insertSection,
  mergeSections,
  moveSection,
  renameSection,
  setHeadingLevel,
  setSeoMeta,
  setSlug,
  setSubtitle,
  setTitle,
  // Lifecycle — guest-driven session end.
  endInterview,
];

let _byName: Map<string, Tool> | null = null;

function byName(): Map<string, Tool> {
  if (_byName) return _byName;
  const map = new Map<string, Tool>();
  for (const tool of ALL_TOOLS) {
    if (map.has(tool.name)) {
      log.warn("Duplicate tool name — keeping first", { name: tool.name });
      continue;
    }
    map.set(tool.name, tool);
  }
  _byName = map;
  return _byName;
}

/** Look up a tool by name. Returns `undefined` for unknown names. */
export function getTool(name: string): Tool | undefined {
  return byName().get(name);
}

export interface ListToolsOptions {
  category?: ToolCategory;
  executionMode?: ToolExecutionMode;
}

/**
 * Filtered tool list. Used by the realtime session mint to advertise
 * tools, and by future per-workspace allowlist filters.
 */
export function listTools(opts: ListToolsOptions = {}): Tool[] {
  return ALL_TOOLS.filter((t) => {
    if (opts.category && t.category !== opts.category) return false;
    if (opts.executionMode && t.executionMode !== opts.executionMode) return false;
    return true;
  });
}

/**
 * Build the OpenAI Realtime `tools` array from the registry. We emit
 * the `{ type: "function", name, description, parameters }` shape the
 * GA `/v1/realtime/client_secrets` endpoint expects.
 *
 * `parameters` is derived from each tool's Zod schema via Zod 4's
 * built-in `z.toJSONSchema`. We strip `$schema` so the resulting
 * object matches the canonical hand-rolled `CANVAS_TOOLS` shape
 * (no extra top-level keys).
 */
export function buildRealtimeToolSchemas(
  opts: ListToolsOptions = {},
): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return listTools(opts).map((t) => {
    const schema = z.toJSONSchema(t.argsSchema) as Record<string, unknown>;
    // Strip JSON-Schema metadata the realtime endpoint doesn't need.
    delete schema.$schema;
    return {
      type: "function" as const,
      name: t.name,
      description: t.description,
      parameters: schema,
    };
  });
}

// Per-session bookkeeping for cap + dedupe enforcement. Keyed by
// interviewId so concurrent interviews on the same instance never
// share budgets or dedupe windows.
interface SessionToolState {
  counts: Map<string, number>;
  dedupeCache: Map<string, { result: ToolResult; expiresAt: number }>;
}

const sessionState = new Map<string, SessionToolState>();

function getSessionState(interviewId: string): SessionToolState {
  let state = sessionState.get(interviewId);
  if (!state) {
    state = { counts: new Map(), dedupeCache: new Map() };
    sessionState.set(interviewId, state);
  }
  return state;
}

/** Discard per-session bookkeeping. Call from interview teardown. */
export function clearSessionState(interviewId: string): void {
  sessionState.delete(interviewId);
  clearRateState(interviewId);
  clearImageBudget(interviewId);
}

export interface DispatchOptions {
  /**
   * OpenAI realtime `call_id` when supplied by the upstream client.
   * Mirrors the existing `withToolCallLogging` contract.
   */
  callId?: string;
}

/**
 * Validate args, enforce dispatcher-level defense-in-depth (size cap,
 * global rate limits, idempotency, per-tool caps, dedupe, workspace
 * cost cap), invoke the handler wrapped in `withToolCallLogging`, and
 * persist an audit row. The dispatcher is the single boundary between
 * the events route and tool handlers — routes never invoke handlers
 * directly.
 *
 * Hardening landed in PR #227:
 *  - Global per-session + per-minute rate limits.
 *  - 32 KB cap on JSON-serialized args.
 *  - Idempotency LRU keyed on `callId` so retransmits return the same ack.
 *  - Workspace `monthlyCostCapUsd` enforcement for LLM-incurring tools.
 *  - Upstream 429/5xx surfaced as a `tool_failed` SSE event without
 *    crashing the dispatcher.
 *  - One audit row per dispatch (success or failure) in `tool_executions`.
 */
export async function dispatchTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
  options: DispatchOptions = {},
): Promise<ToolResult> {
  const dispatchStartedAt = Date.now();
  const argsSummary = summarizeToolArgs(name, rawArgs);

  const tool = getTool(name);
  if (!tool) {
    const result: ToolResult = {
      ok: false,
      category: "permanent",
      message: `Unknown tool "${name}".`,
    };
    await recordToolExecution({
      interviewId: ctx.interviewId,
      toolName: name,
      callId: options.callId,
      argsSummary,
      result,
      durationMs: Date.now() - dispatchStartedAt,
    });
    return result;
  }

  // 1. Args size cap — refuse before any further work so a megabyte
  //    payload never reaches Zod parsing or the worker.
  const argsBytes = measureArgsBytes(rawArgs);
  if (argsBytes === null || argsBytes > MAX_TOOL_ARGS_BYTES) {
    const result: ToolResult = {
      ok: false,
      category: "args_too_large",
      message: `Tool arguments exceed the ${MAX_TOOL_ARGS_BYTES}-byte limit${
        argsBytes !== null ? ` (got ${argsBytes})` : ""
      }.`,
    };
    await recordToolExecution({
      interviewId: ctx.interviewId,
      toolName: name,
      callId: options.callId,
      argsSummary,
      result,
      durationMs: Date.now() - dispatchStartedAt,
    });
    return result;
  }

  // 2. Idempotency — a retransmitted callId returns the original ack
  //    without invoking the handler again. Done BEFORE rate limits so
  //    a retry can't double-charge the budget. Audit log still records
  //    the replay so analytics can detect retry storms.
  const idempotent = lookupIdempotent(ctx.interviewId, options.callId);
  if (idempotent !== undefined) {
    await recordToolExecution({
      interviewId: ctx.interviewId,
      toolName: tool.name,
      callId: options.callId,
      argsSummary,
      result: idempotent,
      durationMs: Date.now() - dispatchStartedAt,
    });
    return idempotent;
  }

  // 3. Global per-session + sliding per-minute rate limits.
  const rate = checkRateLimit(ctx.interviewId);
  if (!rate.allowed) {
    const result = rateLimitedResult(rate);
    await recordToolExecution({
      interviewId: ctx.interviewId,
      toolName: tool.name,
      callId: options.callId,
      argsSummary,
      result,
      durationMs: Date.now() - dispatchStartedAt,
    });
    return result;
  }

  // 4. Zod arg validation.
  const parsed = tool.argsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    const result: ToolResult = {
      ok: false,
      category: "validation",
      message: `Invalid arguments for ${name}: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ")}`,
    };
    await recordToolExecution({
      interviewId: ctx.interviewId,
      toolName: tool.name,
      callId: options.callId,
      argsSummary,
      result,
      durationMs: Date.now() - dispatchStartedAt,
    });
    return result;
  }
  const args = parsed.data;

  const state = getSessionState(ctx.interviewId);

  // 5. Per-tool perSessionCap.
  if (tool.perSessionCap !== undefined) {
    const used = state.counts.get(tool.name) ?? 0;
    if (used >= tool.perSessionCap) {
      const result: ToolResult = {
        ok: false,
        category: "budget",
        message: `Per-session cap reached for ${tool.name} (${tool.perSessionCap}/${tool.perSessionCap}).`,
      };
      await recordToolExecution({
        interviewId: ctx.interviewId,
        toolName: tool.name,
        callId: options.callId,
        argsSummary,
        result,
        durationMs: Date.now() - dispatchStartedAt,
      });
      return result;
    }
  }

  // 6. Workspace cost-cap audit for LLM-incurring tools. We refuse
  //    the dispatch BEFORE the handler runs so the downstream LLM is
  //    never called. The check mirrors the consent-route logic
  //    (`monthlyCostCapUsd` from blogConfig vs the running total of
  //    interview `costUsd` for the calendar month).
  if (tool.incursLlmCost) {
    const capCheck = await checkWorkspaceCostCap(ctx.interviewId);
    if (capCheck.exceeded) {
      const result: ToolResult = {
        ok: false,
        category: "cost_cap_exceeded",
        message: `Workspace monthly cost cap of $${capCheck.capUsd} reached. Tool ${tool.name} refused before LLM call.`,
      };
      log.warn("tool-dispatcher:cost-cap-blocked", {
        interviewId: ctx.interviewId,
        toolName: tool.name,
        capUsd: capCheck.capUsd,
        totalUsd: capCheck.totalUsd,
      });
      await recordToolExecution({
        interviewId: ctx.interviewId,
        toolName: tool.name,
        callId: options.callId,
        argsSummary,
        result,
        durationMs: Date.now() - dispatchStartedAt,
      });
      return result;
    }
  }

  // 7. Per-tool dedupe — second identical call inside the window
  //    returns the cached result. Counts as a "real" dispatch from
  //    the rate-limit perspective so a model can't spam-dedupe to
  //    starve other tools.
  if (tool.dedupe) {
    const key = `${tool.name}:${tool.dedupe.keyFromArgs(args)}`;
    const now = Date.now();
    const cached = state.dedupeCache.get(key);
    if (cached && cached.expiresAt > now) {
      recordDispatch(ctx.interviewId);
      rememberIdempotent(ctx.interviewId, options.callId, cached.result);
      await recordToolExecution({
        interviewId: ctx.interviewId,
        toolName: tool.name,
        callId: options.callId,
        argsSummary,
        result: cached.result,
        durationMs: Date.now() - dispatchStartedAt,
      });
      return cached.result;
    }
    // Fire-and-forget tools push a `tool_in_flight` cue immediately
    // so the AI can tell the user "this'll take a few seconds" before
    // going quiet during the upstream call. Sync tools skip this —
    // they finish well within a turn so the post-call `tool_result`
    // cue alone is enough.
    if (tool.executionMode === "fire-and-forget") {
      await emitToolInFlightEvent(ctx.interviewId, tool.name, options.callId);
    }
    const result = await runWithLogging(tool, args, ctx, options.callId);
    state.dedupeCache.set(key, {
      result,
      expiresAt: now + tool.dedupe.windowMs,
    });
    incrementCount(state, tool.name);
    recordDispatch(ctx.interviewId);
    rememberIdempotent(ctx.interviewId, options.callId, result);
    await maybeEmitToolFailedEvent(ctx.interviewId, tool.name, options.callId, result);
    // Sync tools emit the result cue directly; fire-and-forget tools
    // have already announced themselves via `tool_in_flight` and will
    // emit `tool_completed` from their background callback.
    if (tool.executionMode === "sync") {
      await emitToolResultEvent(ctx.interviewId, tool.name, options.callId, result);
    }
    await recordToolExecution({
      interviewId: ctx.interviewId,
      toolName: tool.name,
      callId: options.callId,
      argsSummary,
      result,
      durationMs: Date.now() - dispatchStartedAt,
    });
    return result;
  }

  if (tool.executionMode === "fire-and-forget") {
    await emitToolInFlightEvent(ctx.interviewId, tool.name, options.callId);
  }
  const result = await runWithLogging(tool, args, ctx, options.callId);
  incrementCount(state, tool.name);
  recordDispatch(ctx.interviewId);
  rememberIdempotent(ctx.interviewId, options.callId, result);
  await maybeEmitToolFailedEvent(ctx.interviewId, tool.name, options.callId, result);
  if (tool.executionMode === "sync") {
    await emitToolResultEvent(ctx.interviewId, tool.name, options.callId, result);
  }
  await recordToolExecution({
    interviewId: ctx.interviewId,
    toolName: tool.name,
    callId: options.callId,
    argsSummary,
    result,
    durationMs: Date.now() - dispatchStartedAt,
  });
  return result;
}

function incrementCount(state: SessionToolState, name: string): void {
  state.counts.set(name, (state.counts.get(name) ?? 0) + 1);
}

async function runWithLogging(
  tool: Tool,
  args: unknown,
  ctx: ToolContext,
  callId: string | undefined,
): Promise<ToolResult> {
  try {
    return await withToolCallLogging(
      {
        interviewId: ctx.interviewId,
        toolName: tool.name,
        callId,
        argsSummary: summarizeToolArgs(tool.name, args),
      },
      () => tool.handler(args, ctx),
      (r: ToolResult) => (r.ok ? (r.summary ?? "ok") : `error:${r.category}`),
    );
  } catch (err: unknown) {
    return classifyHandlerError(err);
  }
}

/**
 * Map a thrown handler error to a structured `ToolResult`. Fire-and-forget
 * tools that call OpenAI / Anthropic / Tavus may throw with a numeric
 * `status` (Anthropic SDK) or `response.status` (fetch). We surface those
 * as `upstream_error` with a retry hint so the model can back off rather
 * than reissue the call immediately.
 */
function classifyHandlerError(err: unknown): ToolResult {
  const status = extractHttpStatus(err);
  const message = err instanceof Error ? err.message : String(err);
  if (status !== null && (status === 429 || status >= 500)) {
    // Honour `retry-after` when the SDK surfaces it on `err.headers`.
    const retryAfterMs = extractRetryAfterMs(err);
    return {
      ok: false,
      category: "upstream_error",
      message: `Upstream ${status}: ${message}`,
      retryAfterMs,
    };
  }
  return {
    ok: false,
    category: "permanent",
    message,
  };
}

function extractHttpStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as Record<string, unknown>;
  if (typeof e.status === "number") return e.status;
  if (typeof e.statusCode === "number") return e.statusCode as number;
  const response = e.response as Record<string, unknown> | undefined;
  if (response && typeof response.status === "number") {
    return response.status;
  }
  return null;
}

function extractRetryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  const headers = e.headers as Record<string, unknown> | undefined;
  if (!headers) return undefined;
  const raw = headers["retry-after"] ?? headers["Retry-After"];
  if (typeof raw === "string") {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return raw * 1000;
  }
  return undefined;
}

/**
 * Emit a `tool_failed` event to the events subcollection when an
 * `upstream_error` result fires from a fire-and-forget tool. The
 * stream route subscribes to this kind so the canvas can surface
 * the failure to the AI and the user without the dispatcher having
 * to throw. Sync canvas tools that fail with `validation` /
 * `not-found` / etc. do NOT emit — those are normal control-flow
 * signals to the model, not upstream provider failures.
 */
async function maybeEmitToolFailedEvent(
  interviewId: string,
  toolName: string,
  callId: string | undefined,
  result: ToolResult,
): Promise<void> {
  if (result.ok) return;
  if (result.category !== "upstream_error") return;
  try {
    await appendEvents(DEFAULT_BLOG_ID, interviewId, [
      {
        ts: new Date().toISOString(),
        kind: "tool_failed",
        payload: {
          toolName,
          callId: callId ?? null,
          errorKind: result.category,
          message: result.message,
          retryAfterMs: result.retryAfterMs ?? null,
        },
      },
    ]);
  } catch (err: unknown) {
    log.warn("tool-dispatcher:emit-tool-failed-failed", {
      interviewId,
      toolName,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

export { emitFireAndForgetCompletion } from "./_narration-events";

interface CostCapCheck {
  exceeded: boolean;
  capUsd: number | null;
  totalUsd: number;
}

/**
 * Read the workspace's `monthlyCostCapUsd` and the sum of interview
 * `costUsd` for the current calendar month. Returns `exceeded: true`
 * when the cap is set and the running total is at or over the cap.
 *
 * Cached implicitly by the caller's discipline — the dispatcher only
 * calls this when `tool.incursLlmCost` is set, which is the very small
 * subset of tools that trigger downstream LLMs. Wraps the D1 read in
 * try/catch so a transient error fails OPEN (i.e. lets the tool through
 * and logs a warning) rather than wedging the interview.
 */
async function checkWorkspaceCostCap(
  interviewId: string,
): Promise<CostCapCheck> {
  try {
    const config = await getBlogConfig();
    const capUsd = config?.interview?.monthlyCostCapUsd ?? null;
    if (capUsd === null || capUsd <= 0) {
      return { exceeded: false, capUsd, totalUsd: 0 };
    }

    const totalUsd = await sumMonthlyInterviewCostUsd(DEFAULT_BLOG_ID);

    const exceeded = totalUsd >= capUsd;
    return { exceeded, capUsd, totalUsd };
  } catch (err: unknown) {
    log.warn("tool-dispatcher:cost-cap-check-failed", {
      interviewId,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    // Fail open — the cost cap is a soft guardrail, not a security
    // boundary. The hard enforcement happens at `consent` and `end`
    // which already protect against an interview running past the cap.
    return { exceeded: false, capUsd: null, totalUsd: 0 };
  }
}

/** Build a `ToolContext` from a worker — used by routes. */
export function buildToolContext(opts: {
  interviewId: string;
  worker: WriterWorker;
}): ToolContext {
  return {
    interviewId: opts.interviewId,
    worker: opts.worker,
    logger: log,
    getCurrentCanvas: () => opts.worker.getCanvas(),
  };
}
