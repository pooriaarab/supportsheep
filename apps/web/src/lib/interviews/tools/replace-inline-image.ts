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

const log = createLogger("interviews:tools:replace_inline_image");

const argsSchema = z
  .object({
    imageId: z.string().min(1).max(120),
    prompt: z.string().max(500).optional(),
    query: z.string().max(120).optional(),
    source: z.enum(["unsplash", "ai"]).optional(),
    url: z.string().url().max(2000).optional(),
  })
  .refine((d) => !!(d.prompt || d.url || d.query), {
    message: "Either prompt, query, or url must be provided",
  });

/**
 * Phase 5 — fire-and-forget inline image replacement. Mirrors
 * `insert_inline_image`'s prompt-or-URL contract but targets an
 * existing image id instead of a section. Returns `not-found` if
 * the image id is unknown.
 *
 * Capped at 5 per session — replacement chains aggressively in
 * practice ("no, redder", "no, darker") and a tight cap forces the
 * speaker to commit.
 */
export default {
  name: "replace_inline_image",
  description:
    "Replace an existing inline image by id. Pass a URL for instant swap or a prompt for AI regeneration.",
  category: "images",
  argsSchema,
  executionMode: "fire-and-forget",
  perSessionCap: 5,
  handler: (args, ctx) => {
    const callId = `replace-image-${Date.now()}`;

    // Sync URL replacement when supplied.
    if (args.url && !args.prompt && !args.query) {
      const replaced = ctx.worker.replaceImage({
        imageId: args.imageId,
        url: args.url,
      });
      if (!replaced) {
        return {
          ok: false,
          category: "not-found",
          message: `Image "${args.imageId}" not found.`,
        };
      }
      log.info("replace_inline_image replaced via url", {
        interviewId: ctx.interviewId,
        callId,
        imageId: args.imageId,
      });
      return { ok: true, summary: "queued" };
    }

    const resolvedSource = args.source ?? (args.query ? "unsplash" : "ai");

    if (resolvedSource === "ai" && wouldExceedImageBudget(ctx.interviewId)) {
      log.warn("replace_inline_image refused — image budget exceeded", {
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

    log.info("replace_inline_image queued for generation", {
      interviewId: ctx.interviewId,
      callId,
      imageId: args.imageId,
      source: resolvedSource,
    });

    void (async () => {
      try {
        const result = await generateImage({
          title: ctx.getCurrentCanvas().title ?? "Inline image",
          purpose: "inline",
          customPrompt: args.prompt,
          source: resolvedSource,
          query: args.query,
          storagePrefix: `interview-${ctx.interviewId}-inline-replace`,
        });
        if (result.source === "ai") recordImageSpend(ctx.interviewId);
        const replaced = ctx.worker.replaceImage({
          imageId: args.imageId,
          url: result.url,
          alt: result.alt,
          prompt: result.prompt,
          source: result.source,
          attribution: result.attribution,
        });
        if (!replaced) {
          log.warn(
            "replace_inline_image background completed but image vanished",
            { interviewId: ctx.interviewId, callId, imageId: args.imageId },
          );
          return;
        }
        log.info("replace_inline_image background completed", {
          interviewId: ctx.interviewId,
          callId,
          imageId: args.imageId,
          url: result.url,
          source: result.source,
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "replace_inline_image",
          { ok: true, summary: "inline_image_replaced" },
        );
      } catch (err: unknown) {
        const isNotConfigured = err instanceof ImageProviderNotConfiguredError;
        const errorMessage = isNotConfigured
          ? "Image generation not configured"
          : err instanceof Error
            ? err.message
            : String(err);
        log.error("replace_inline_image background failed", {
          interviewId: ctx.interviewId,
          callId,
          error: errorMessage,
          notConfigured: isNotConfigured,
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "replace_inline_image",
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
