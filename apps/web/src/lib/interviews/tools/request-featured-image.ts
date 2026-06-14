import { z } from "zod";
import { createLogger } from "@/lib/logger";
import {
  generateImage,
  ImageProviderNotConfiguredError,
} from "@/lib/ai/generate-image";
import { appendEvents } from "@/lib/interviews/events-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import {
  recordImageSpend,
  wouldExceedImageBudget,
  IMAGE_BUDGET_CAP_USD,
} from "../image-budget";
import { emitFireAndForgetCompletion } from "./_narration-events";
import type { Tool } from "./_types";

const log = createLogger("interviews:tools:request_featured_image");

/**
 * Surface a background failure to the SSE stream so the AI gets a
 * narration ("the image gen failed — keep talking") instead of waiting
 * forever for an image that never arrives. Mirrors the dispatcher's
 * `maybeEmitToolFailedEvent` for sync upstream errors but originates
 * from inside the fire-and-forget callback where the dispatcher has
 * already returned `{ ok: true, summary: "queued" }`.
 */
async function emitBackgroundFailure(
  interviewId: string,
  callId: string,
  errorMessage: string,
): Promise<void> {
  try {
    await appendEvents(DEFAULT_BLOG_ID, interviewId, [
      {
        ts: new Date().toISOString(),
        kind: "tool_failed",
        payload: {
          toolName: "request_featured_image",
          callId,
          errorKind: "upstream_error",
          message: errorMessage,
        },
      },
    ]);
  } catch (err: unknown) {
    log.warn("request_featured_image emit-tool-failed-failed", {
      interviewId,
      callId,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

const argsSchema = z
  .object({
    /** AI image prompt — required when `source === "ai"`. */
    prompt: z.string().min(1).max(500).optional(),
    /**
     * Short Unsplash search query (3-5 words) — required when
     * `source === "unsplash"`. Keeping it terse improves recall.
     */
    query: z.string().min(1).max(120).optional(),
    /**
     * Image source. `unsplash` for stock-realistic photography
     * (preferred when the concept is a real-world subject); `ai` for
     * abstract / illustrative concepts. Defaults to `unsplash` when a
     * query is given, otherwise `ai`.
     */
    source: z.enum(["unsplash", "ai"]).optional(),
    style: z.string().max(120).optional(),
    aspectRatio: z.enum(["16:9", "1:1", "4:3"]).optional(),
  })
  .refine((d) => !!(d.prompt || d.query), {
    message: "Either prompt (for AI) or query (for Unsplash) must be provided",
  });

/**
 * Phase 5 — fire-and-forget hero image generation. Ack returns
 * immediately so OpenAI Realtime doesn't stall on the upstream
 * round-trip. The background callback pushes the new image to the
 * canvas via the worker's `setFeaturedImage`, which emits a
 * `featured_image_updated` diff that lands in the SSE stream.
 *
 * Capped at 4 calls per session for cost protection. Identical
 * prompts/queries within a 30s window dedupe to a cached ack.
 *
 * Two upstream paths:
 * - `source: "unsplash"` (preferred) — searches Unsplash for stock
 *   photography. Free, low latency, returns attribution.
 * - `source: "ai"` — falls through to gpt-image-1. Used for abstract
 *   or illustrative imagery and gated by an in-process per-interview
 *   image spend cap (see `image-budget.ts`).
 */
export default {
  name: "request_featured_image",
  description:
    "Queue a featured (hero) image. For stock photography of a real-world subject, set source=unsplash and pass a short query (3-5 words). For abstract / illustrative imagery, set source=ai and pass a prompt. Returns immediately; the image arrives via the SSE stream when ready.",
  category: "images",
  argsSchema,
  executionMode: "fire-and-forget",
  perSessionCap: 4,
  dedupe: {
    keyFromArgs: (args) =>
      `${args.source ?? ""}|${args.query ?? ""}|${args.prompt ?? ""}|${args.style ?? ""}|${args.aspectRatio ?? ""}`,
    windowMs: 30_000,
  },
  handler: (args, ctx) => {
    const callId = `featured-${Date.now()}`;
    const resolvedSource = args.source ?? (args.query ? "unsplash" : "ai");

    log.info("request_featured_image queued", {
      interviewId: ctx.interviewId,
      callId,
      source: resolvedSource,
      promptLength: args.prompt?.length,
      queryLength: args.query?.length,
      aspectRatio: args.aspectRatio,
    });

    // Per-interview AI-spend cap: only applies to the `ai` branch
    // because Unsplash lookups are free. We refuse the dispatch
    // synchronously so the budget refusal lands in the immediate
    // ack rather than a fire-and-forget failure 10s later.
    if (resolvedSource === "ai" && wouldExceedImageBudget(ctx.interviewId)) {
      log.warn("request_featured_image refused — image budget exceeded", {
        interviewId: ctx.interviewId,
        callId,
        capUsd: IMAGE_BUDGET_CAP_USD,
      });
      return {
        ok: false,
        category: "budget",
        message: `Per-interview image budget of $${IMAGE_BUDGET_CAP_USD} reached.`,
      };
    }

    // Detached background work — surfaces completion via a
    // `tool_completed` SSE cue so the AI can narrate the result
    // ("the image is ready"). Failures emit the same cue with
    // `ok: false` so the AI acknowledges and recovers verbally
    // instead of going silent, and also emit a `tool_failed` SSE
    // event so the AI receives a structured failure narration on
    // the SSE stream.
    void (async () => {
      const backgroundStartedAt = Date.now();
      log.info("request_featured_image background started", {
        interviewId: ctx.interviewId,
        callId,
        canvasTitle: ctx.getCurrentCanvas().title ?? null,
      });
      try {
        const result = await generateImage({
          title: ctx.getCurrentCanvas().title ?? "Featured image",
          purpose: "featured-image",
          imageStyle: args.style,
          imageAspectRatio: args.aspectRatio ?? "16:9",
          customPrompt: args.prompt,
          source: resolvedSource,
          query: args.query,
          storagePrefix: `interview-${ctx.interviewId}-featured`,
        });
        if (result.source === "ai") recordImageSpend(ctx.interviewId);
        log.info("request_featured_image generateImage resolved", {
          interviewId: ctx.interviewId,
          callId,
          url: result.url,
          source: result.source,
          durationMs: Date.now() - backgroundStartedAt,
        });
        ctx.worker.setFeaturedImage({
          url: result.url,
          alt: result.alt,
          prompt: result.prompt,
          source: result.source,
          attribution: result.attribution,
        });
        log.info("request_featured_image background completed", {
          interviewId: ctx.interviewId,
          callId,
          url: result.url,
          totalDurationMs: Date.now() - backgroundStartedAt,
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "request_featured_image",
          { ok: true, summary: "featured_image_ready" },
        );
      } catch (err: unknown) {
        // Soft-fail when no provider is configured so the AI gets a
        // clear narration rather than a generic "upstream 500".
        const isNotConfigured = err instanceof ImageProviderNotConfiguredError;
        const errorMessage = isNotConfigured
          ? "Image generation not configured"
          : err instanceof Error
            ? err.message
            : String(err);
        log.error("request_featured_image background failed", {
          interviewId: ctx.interviewId,
          callId,
          error: errorMessage,
          notConfigured: isNotConfigured,
          durationMs: Date.now() - backgroundStartedAt,
        });
        await emitBackgroundFailure(ctx.interviewId, callId, errorMessage);
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "request_featured_image",
          {
            ok: false,
            message: errorMessage,
          },
        );
      }
    })();

    return { ok: true, summary: "queued" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
