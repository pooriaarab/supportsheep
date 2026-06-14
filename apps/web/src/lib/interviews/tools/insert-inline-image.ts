import { z } from "zod";
import { createLogger } from "@/lib/logger";
import {
  generateImage,
  ImageProviderNotConfiguredError,
} from "@/lib/ai/generate-image";
import {
  recordImageSpend,
  wouldExceedImageBudget,
  IMAGE_BUDGET_CAP_USD,
} from "../image-budget";
import { emitFireAndForgetCompletion } from "./_narration-events";
import type { Tool } from "./_types";

const log = createLogger("interviews:tools:insert_inline_image");

const argsSchema = z
  .object({
    sectionId: z.string().min(1).max(64),
    afterParagraphId: z.string().max(120).optional(),
    afterParagraphIndex: z.number().int().nonnegative().optional(),
    /** AI image prompt — used when `source === "ai"`. */
    prompt: z.string().max(500).optional(),
    /** Short Unsplash search query — used when `source === "unsplash"`. */
    query: z.string().max(120).optional(),
    /**
     * Preferred image source. Defaults to `unsplash` when a query is
     * given, otherwise `ai`. Ignored when `urlIfKnown` is supplied.
     */
    source: z.enum(["unsplash", "ai"]).optional(),
    urlIfKnown: z.string().url().max(2000).optional(),
    alt: z.string().max(150).optional(),
  })
  .refine((d) => !!(d.prompt || d.urlIfKnown || d.query), {
    message: "Either prompt, query, or urlIfKnown must be provided",
  });

/**
 * Phase 5 — fire-and-forget image insertion or sync URL embed.
 *
 * Three flows:
 * 1. `urlIfKnown` supplied → sync. The image is added to the section
 *    immediately (no upstream cost).
 * 2. `query` supplied (or `source: "unsplash"`) → fire-and-forget
 *    Unsplash search. Free, low-latency stock photography.
 * 3. `prompt` supplied (or `source: "ai"`) → fire-and-forget AI
 *    generation via gpt-image-1.
 *
 * Capped at 10 inline images per session; dedupes on prompt/query/url
 * across a 30s window to absorb the chatty re-asks the model can
 * emit during multi-turn debate.
 */
export default {
  name: "insert_inline_image",
  description:
    "Insert an inline image into a section. Pass urlIfKnown for instant placement, query+source=unsplash for stock photography, or prompt+source=ai for AI generation.",
  category: "images",
  argsSchema,
  executionMode: "fire-and-forget",
  perSessionCap: 10,
  dedupe: {
    keyFromArgs: (args) =>
      `${args.sectionId}|${args.source ?? ""}|${args.query ?? ""}|${args.prompt ?? ""}|${args.urlIfKnown ?? ""}`,
    windowMs: 30_000,
  },
  handler: (args, ctx) => {
    const callId = `inline-image-${Date.now()}`;
    const altDefault =
      args.alt ??
      args.prompt?.slice(0, 120) ??
      args.query?.slice(0, 120) ??
      "Inline image";

    // Fast path: known URL. Apply immediately as a "sync inside
    // fire-and-forget" — still returns the same `queued` shape so the
    // model's downstream handling is uniform.
    if (args.urlIfKnown && !args.prompt && !args.query) {
      const placed = ctx.worker.insertInlineImage({
        sectionId: args.sectionId,
        url: args.urlIfKnown,
        alt: altDefault,
        afterParagraphIndex: args.afterParagraphIndex,
      });
      if (!placed) {
        return {
          ok: false,
          category: "not-found",
          message: `Section "${args.sectionId}" not found.`,
        };
      }
      log.info("insert_inline_image placed url synchronously", {
        interviewId: ctx.interviewId,
        callId,
        sectionId: args.sectionId,
      });
      return { ok: true, summary: "queued" };
    }

    const resolvedSource = args.source ?? (args.query ? "unsplash" : "ai");

    if (resolvedSource === "ai" && wouldExceedImageBudget(ctx.interviewId)) {
      log.warn("insert_inline_image refused — image budget exceeded", {
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

    log.info("insert_inline_image queued for generation", {
      interviewId: ctx.interviewId,
      callId,
      sectionId: args.sectionId,
      source: resolvedSource,
      promptLength: args.prompt?.length,
      queryLength: args.query?.length,
    });

    void (async () => {
      try {
        const result = await generateImage({
          title: ctx.getCurrentCanvas().title ?? "Inline image",
          purpose: "inline",
          customPrompt: args.prompt,
          source: resolvedSource,
          query: args.query,
          storagePrefix: `interview-${ctx.interviewId}-inline`,
        });
        if (result.source === "ai") recordImageSpend(ctx.interviewId);
        const placed = ctx.worker.insertInlineImage({
          sectionId: args.sectionId,
          url: result.url,
          alt: args.alt ?? result.alt,
          prompt: result.prompt,
          source: result.source,
          attribution: result.attribution,
          afterParagraphIndex: args.afterParagraphIndex,
        });
        if (!placed) {
          log.warn(
            "insert_inline_image background completed but section vanished",
            { interviewId: ctx.interviewId, callId, sectionId: args.sectionId },
          );
          return;
        }
        log.info("insert_inline_image background completed", {
          interviewId: ctx.interviewId,
          callId,
          url: result.url,
          source: result.source,
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "insert_inline_image",
          { ok: true, summary: "inline_image_inserted" },
        );
      } catch (err: unknown) {
        const isNotConfigured = err instanceof ImageProviderNotConfiguredError;
        const errorMessage = isNotConfigured
          ? "Image generation not configured"
          : err instanceof Error
            ? err.message
            : String(err);
        log.error("insert_inline_image background failed", {
          interviewId: ctx.interviewId,
          callId,
          error: errorMessage,
          notConfigured: isNotConfigured,
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "insert_inline_image",
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
