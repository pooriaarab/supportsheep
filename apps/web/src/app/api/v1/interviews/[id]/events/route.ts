import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { getDb } from "@/db";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { appendEvents, listEventsSince } from "@/lib/interviews/events-repository";
import { verifyInterviewToken } from "@/lib/interviews/interview-token";
import { resolveInterviewTokenFromRequest } from "@/lib/interviews/interview-token-request";
import {
  buildToolContext,
  dispatchTool,
} from "@/lib/interviews/tools";
import { getOrCreateWorker } from "@/lib/interviews/writer-worker-registry";
import { updateInterview } from "@/lib/interviews/interviews-repository";
import { getProviderApiKey } from "@/lib/ai/providers";
import { type InterviewLanguage } from "@/lib/interviews/share-link-schema";
import { createLogger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("interviews:events");

// Strict bound on any client-reported token count. The cost-cap is now
// derived from server-authoritative usage (F-003), so these numbers are only
// used for live UI counters — but we still clamp to a sane integer range so a
// malicious guest cannot stuff `Number.MAX_SAFE_INTEGER` into the payload and
// poison `aggregateUsage`-fed dashboards (`/cost/summary`, `/[id]/cost`).
const TOKEN_COUNT_MAX = 1_000_000;
const clientUsageSchema = z
  .object({
    input_tokens: z.number().int().min(0).max(TOKEN_COUNT_MAX).optional(),
    output_tokens: z.number().int().min(0).max(TOKEN_COUNT_MAX).optional(),
    cache_read_input_tokens: z.number().int().min(0).max(TOKEN_COUNT_MAX).optional(),
  })
  .passthrough()
  .optional();

// Per-field caps for F-008. Without these the previously unbounded payload
// let a guest holding a valid interview token commit documents up to
// the 1 MB per-doc hard cap × 100 entries × 120 batches/min, eating any
// reasonable quota and ballooning the events collection so
// downstream aggregation queries (`aggregateUsage`, `/cost/summary`) time out.
const TRANSCRIPT_TEXT_MAX = 8_000;
const CHAT_INPUT_TEXT_MAX = 4_000;
const TOOL_CALL_NAME_MAX = 128;
const TOOL_CALL_ARGS_MAX = 4_000;
const ERROR_MESSAGE_MAX = 2_000;

const transcriptPayload = z
  .object({
    text: z.string().max(TRANSCRIPT_TEXT_MAX).optional(),
    // `usage` is best-effort client metadata; the strict schema rejects
    // dashboard-poisoning values while still letting the realtime SDK
    // forward its native `usage` block on transcript_ai events.
    usage: clientUsageSchema,
  })
  .passthrough();

const chatInputPayload = z
  .object({
    text: z.string().max(CHAT_INPUT_TEXT_MAX).optional(),
  })
  .passthrough();

const toolCallPayload = z
  .object({
    name: z.string().max(TOOL_CALL_NAME_MAX).optional(),
    callId: z.string().max(TOOL_CALL_NAME_MAX).optional(),
    call_id: z.string().max(TOOL_CALL_NAME_MAX).optional(),
    arguments: z
      .union([
        z.string().max(TOOL_CALL_ARGS_MAX),
        z.record(z.string(), z.unknown()),
        z.array(z.unknown()),
        z.null(),
      ])
      .optional(),
  })
  .passthrough();

const errorPayload = z
  .object({
    message: z.string().max(ERROR_MESSAGE_MAX).optional(),
  })
  .passthrough();

const eventSchema = z.discriminatedUnion("kind", [
  z.object({ ts: z.string().datetime(), kind: z.literal("transcript_user"), payload: transcriptPayload }),
  z.object({ ts: z.string().datetime(), kind: z.literal("transcript_ai"), payload: transcriptPayload }),
  z.object({ ts: z.string().datetime(), kind: z.literal("chat_input"), payload: chatInputPayload }),
  z.object({ ts: z.string().datetime(), kind: z.literal("attachment"), payload: z.object({}).passthrough() }),
  z.object({ ts: z.string().datetime(), kind: z.literal("tool_call"), payload: toolCallPayload }),
  z.object({ ts: z.string().datetime(), kind: z.literal("canvas_update"), payload: z.unknown() }),
  z.object({ ts: z.string().datetime(), kind: z.literal("writer_update"), payload: z.unknown() }),
  z.object({ ts: z.string().datetime(), kind: z.literal("error"), payload: errorPayload }),
]);

const eventsInputSchema = z.array(eventSchema).min(1).max(100);

/**
 * Hard ceiling on the JSON-serialized batch size, applied *after* schema
 * validation as a belt-and-braces guard against attacker-controlled keys
 * slipping through `passthrough()`.
 */
const EVENTS_BATCH_MAX_BYTES = 64 * 1024;

export const POST = createApiHandler({
  auth: "none",
  rateLimit: {
    key: "interview-events",
    maxPerMinute: RATE_LIMITS["interview-events"],
  },
  input: eventsInputSchema,
  handler: async ({ body, request, params }) => {
    const { id } = params as { id: string };

    // 1. Authorize via interview cookie set on /consent, or legacy
    //    `Authorization: Bearer` header for clients that have not yet
    //    migrated off the URL-token pathway.
    const resolved = resolveInterviewTokenFromRequest(request, id);
    if (!resolved) {
      return NextResponse.json({ error: "Missing interview token" }, { status: 401 });
    }

    const tokenPayload = verifyInterviewToken(resolved.token);
    if (!tokenPayload) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 2. Cross-verify that the token interview ID matches params ID
    if (tokenPayload.interviewId !== id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 2b. Reject batches whose serialized JSON exceeds the byte cap (F-008).
    //     Per-field caps above bound individual string fields but a permissive
    //     `.passthrough()` could still allow many unknown keys; this guards
    //     the worst-case total write.
    const serialized = JSON.stringify(body);
    if (serialized.length > EVENTS_BATCH_MAX_BYTES) {
      return NextResponse.json(
        { error: "events batch exceeds size limit" },
        { status: 413 },
      );
    }

    // 3. Load interview from D1 and check status.
    //    blogId defaults to "default" for single-tenant installs; the D1
    //    tenant scope uses blogId so we must pass it through.
    const blogId = "default";
    let interviewData: {
      status: string;
      topic?: string | null;
      goal?: string | null;
      language?: InterviewLanguage;
      canvasSnapshot?: import("@/lib/interviews/writer-worker").CanvasState | null;
    };
    try {
      const row = await getInterview(blogId, id, getDb());
      if (!row) {
        return NextResponse.json({ error: "Interview not found" }, { status: 404 });
      }
      interviewData = {
        status: row.status,
        topic: row.topic,
        goal: row.goal,
        language: row.language,
        canvasSnapshot: row.canvasSnapshot as import("@/lib/interviews/writer-worker").CanvasState | null,
      };
    } catch (err: unknown) {
      log.error("events:load-interview threw", {
        interviewId: id,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack?.slice(0, 1500) : undefined,
      });
      return NextResponse.json(
        { error: "Failed to load interview" },
        { status: 500 },
      );
    }
    if (interviewData.status !== "live") {
      return NextResponse.json(
        { error: "Cannot ingest events for interview that is not live" },
        { status: 409 },
      );
    }

    // 4. Batch-write events to D1. This is the canonical persistence.
    //    The writer-worker dispatch below is a *best-effort* in-memory
    //    pipeline that can fail independently without losing data.
    try {
      await appendEvents(
        blogId,
        id,
        body.map((ev) => ({ kind: ev.kind, ts: ev.ts, payload: ev.payload })),
        getDb(),
      );
    } catch (err: unknown) {
      log.error("events:batch-commit threw", {
        interviewId: id,
        eventCount: body.length,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack?.slice(0, 1500) : undefined,
      });
      return NextResponse.json(
        { error: "Failed to persist events" },
        { status: 500 },
      );
    }

    // 5. Dispatch transcript/tool events to the WriterWorker.
    //    Every part of this block is wrapped in try/catch — the events
    //    are already durable in D1 from step 4, so a worker
    //    failure must NOT 502 the response. Returning 502 here was the
    //    immediate cause of the user-visible "Failed to flush events"
    //    spam in production: a worker init or transient Anthropic error
    //    on a cold-started instance bubbled up as a generic 502, the
    //    client retried the same batch endlessly, and the canvas never
    //    got transcript chunks because the dispatcher was wedged on
    //    failure.
    let workerDispatchedToolCalls = false;
    try {
      const apiKey = await getProviderApiKey("claude");
      // Seed a freshly minted worker with the cross-instance canvas
      // snapshot so tool batches landing on this lambda see prior
      // sections, paragraphs, title, and SEO meta written by other
      // lambdas.
      const snapshotForHydrate = interviewData.canvasSnapshot ?? null;
      const worker = getOrCreateWorker({
        interviewId: id,
        topic: interviewData.topic ?? undefined,
        goal: interviewData.goal ?? undefined,
        language: interviewData.language,
        apiKey,
        hydrateFrom: snapshotForHydrate,
      });
      const toolCtx = buildToolContext({ interviewId: id, worker });
      for (const ev of body) {
        if (ev.kind === "transcript_user" || ev.kind === "transcript_ai") {
          const text = (ev.payload as { text?: string })?.text;
          log.info("realtime_conversation_event", {
            interviewId: id,
            kind: ev.kind,
            ts: ev.ts,
            textLength: typeof text === "string" ? text.length : 0,
          });
          if (typeof text === "string") {
            worker.appendTranscript(text);
            workerDispatchedToolCalls = true;
          }
        } else if (ev.kind === "chat_input") {
          const text = (ev.payload as { text?: string })?.text;
          if (typeof text === "string" && text.trim().length > 0) {
            log.info("Forwarding chat_input guide note to writer", {
              interviewId: id,
              textLength: text.length,
            });
            worker.appendTranscript(`[Guide note from author]: ${text}`);
            workerDispatchedToolCalls = true;
          }
        } else if (ev.kind === "tool_call") {
          const p = ev.payload as {
            name?: string;
            arguments?: unknown;
            callId?: string;
            call_id?: string;
          };
          if (typeof p.name === "string") {
            const toolName = p.name;
            const callId =
              typeof p.callId === "string"
                ? p.callId
                : typeof p.call_id === "string"
                  ? p.call_id
                  : undefined;
            await dispatchTool(toolName, p.arguments, toolCtx, { callId });
            workerDispatchedToolCalls = true;
          }
        }
      }

      // Persist the freshest canvas state as `canvasSnapshot` after every
      // batch that mutated the worker. The /end route reads this field
      // when its in-memory worker is empty (cross-instance fallback).
      if (workerDispatchedToolCalls) {
        try {
          const canvas = worker.getCanvas();
          await updateInterview(blogId, id, {
            canvasSnapshot: canvas as unknown as Record<string, unknown>,
            canvasSnapshotAt: Date.now(),
          }, getDb());
        } catch (err: unknown) {
          log.warn("events:canvas-snapshot write failed (non-fatal)", {
            interviewId: id,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err: unknown) {
      log.error("events:worker-dispatch threw (non-fatal — events persisted)", {
        interviewId: id,
        eventCount: body.length,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack?.slice(0, 1500) : undefined,
      });
      // Don't fail the request — the events are persisted, the worker
      // can be re-seeded from D1 on the next batch.
    }

    return NextResponse.json({ accepted: body.length });
  },
});

export const GET = createApiHandler({
  auth: "user",
  handler: async ({ params, request, role }) => {
    const { id } = params as { id: string };

    // 1. Enforce write-capable role (owner/admin/editor).
    if (!role || (role !== "admin" && role !== "editor" && role !== "owner")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const sinceParam = searchParams.get("since") || "";

    const blogId = "default";
    const events = await listEventsSince(
      blogId,
      id,
      {
        cursor: sinceParam ? { afterTs: sinceParam, afterId: "" } : undefined,
        limit: limitParam,
      },
      getDb(),
    );

    return NextResponse.json({
      events: events.map((ev) => ({
        id: ev.id,
        ts: ev.ts,
        kind: ev.kind,
        payload: ev.payload,
      })),
    });
  },
});
