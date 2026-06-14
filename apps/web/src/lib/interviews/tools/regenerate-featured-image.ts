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

const log = createLogger("interviews:tools:regenerate_featured_image");

const argsSchema = z.object({
  reason: z.string().min(1).max(500),
  prompt: z.string().max(500).optional(),
  /** Optional Unsplash query — used when `source === "unsplash"`. */
  query: z.string().max(120).optional(),
  /** Image source for the regenerated asset. Defaults to `ai`. */
  source: z.enum(["unsplash", "ai"]).optional(),
});

/**
 * Phase 5 — fire-and-forget regenerate of the existing featured
 * image. The model passes a free-form `reason` ("user said it's too
 * dark") which we forward to the image prompt builder; an explicit
 * `prompt` override skips the builder entirely.
 *
 * Caps at 3 calls per session — slightly tighter than the initial
 * `request_featured_image` cap because regeneration tends to chain
 * (user-driven retries) more aggressively.
 */
export default {
  name: "regenerate_featured_image",
  description:
    "Regenerate the existing featured image using a reason or override prompt. Returns immediately; the new image arrives via SSE.",
  category: "images",
  argsSchema,
  executionMode: "fire-and-forget",
  perSessionCap: 3,
  handler: (args, ctx) => {
    const callId = `regen-featured-${Date.now()}`;
    const resolvedSource = args.source ?? (args.query ? "unsplash" : "ai");

    log.info("regenerate_featured_image queued", {
      interviewId: ctx.interviewId,
      callId,
      source: resolvedSource,
      hasOverridePrompt: !!args.prompt,
      hasOverrideQuery: !!args.query,
    });

    if (resolvedSource === "ai" && wouldExceedImageBudget(ctx.interviewId)) {
      log.warn("regenerate_featured_image refused — image budget exceeded", {
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

    void (async () => {
      try {
        const canvas = ctx.getCurrentCanvas();
        const promptInput =
          args.prompt?.trim() ??
          (resolvedSource === "ai"
            ? `${canvas.title ?? "Featured image"}. Feedback for regeneration: ${args.reason}`
            : undefined);
        const result = await generateImage({
          title: canvas.title ?? "Featured image",
          purpose: "featured-image",
          customPrompt: promptInput,
          source: resolvedSource,
          query: args.query,
          imageAspectRatio: "16:9",
          storagePrefix: `interview-${ctx.interviewId}-featured-regen`,
        });
        if (result.source === "ai") recordImageSpend(ctx.interviewId);
        const existing = canvas.featuredImage;
        if (existing) {
          ctx.worker.replaceImage({
            imageId: existing.id,
            url: result.url,
            alt: result.alt,
            prompt: result.prompt,
            source: result.source,
            attribution: result.attribution,
          });
        } else {
          ctx.worker.setFeaturedImage({
            url: result.url,
            alt: result.alt,
            prompt: result.prompt,
            reason: args.reason,
            source: result.source,
            attribution: result.attribution,
          });
        }
        log.info("regenerate_featured_image background completed", {
          interviewId: ctx.interviewId,
          callId,
          url: result.url,
          source: result.source,
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "regenerate_featured_image",
          { ok: true, summary: "featured_image_regenerated" },
        );
      } catch (err: unknown) {
        const isNotConfigured = err instanceof ImageProviderNotConfiguredError;
        const errorMessage = isNotConfigured
          ? "Image generation not configured"
          : err instanceof Error
            ? err.message
            : String(err);
        log.error("regenerate_featured_image background failed", {
          interviewId: ctx.interviewId,
          callId,
          error: errorMessage,
          notConfigured: isNotConfigured,
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "regenerate_featured_image",
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
