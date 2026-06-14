import { createHash } from "node:crypto";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { calculateSeoScore } from "@/lib/seo/scoring";
import { emitFireAndForgetCompletion } from "./_narration-events";
import type { CanvasState } from "../writer-worker";
import type { Tool } from "./_types";

const log = createLogger("interviews:tools:request_seo_score");

const argsSchema = z.object({}).strict();

/**
 * Phase 5 — fire-and-forget SEO scoring. Computes a 0-100 score
 * over the current canvas using the same scoring engine the
 * publish-side editor uses (`@/lib/seo/scoring`), then pushes the
 * result to the canvas via the SSE diff stream.
 *
 * Dedupes on the canvas content hash over 60s so repeated asks
 * during a single discussion turn don't redo the work. Capped at
 * 6 calls per session.
 */
export default {
  name: "request_seo_score",
  description:
    "Score the article's SEO on a 0-100 scale. Result arrives via the SSE stream.",
  category: "seo",
  argsSchema,
  executionMode: "fire-and-forget",
  perSessionCap: 6,
  dedupe: {
    // Args are empty; dedupe on the canvas content hash captured at
    // dispatch time. Same hash within 60s ⇒ cached ack returned.
    keyFromArgs: () => "canvas-hash",
    windowMs: 60_000,
  },
  handler: (_args, ctx) => {
    const callId = `seo-score-${Date.now()}`;
    log.info("request_seo_score queued", {
      interviewId: ctx.interviewId,
      callId,
    });

    void (async () => {
      try {
        const canvas = ctx.getCurrentCanvas();
        const body = canvasToMarkdown(canvas);
        const result = calculateSeoScore({
          body,
          metaTitle: canvas.title ?? "",
          metaDescription: canvas.meta.description ?? "",
          keywords: canvas.keywords ?? [],
          postType: "blog_post",
        });
        const issues = result.metrics
          .filter((m) => m.status === "poor")
          .map((m) => `${m.label}: ${m.detail}`);
        const suggestions = result.metrics
          .map((m) => m.suggestion)
          .filter((s): s is string => !!s);
        ctx.worker.setSeoScore({
          score: result.total,
          issues,
          suggestions,
          scoredAt: new Date().toISOString(),
        });
        log.info("request_seo_score background completed", {
          interviewId: ctx.interviewId,
          callId,
          score: result.total,
          contentHash: hashCanvas(canvas),
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "request_seo_score",
          { ok: true, summary: `seo_score=${result.total}` },
        );
      } catch (err: unknown) {
        log.error("request_seo_score background failed", {
          interviewId: ctx.interviewId,
          callId,
          error: err instanceof Error ? err.message : String(err),
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "request_seo_score",
          {
            ok: false,
            message: err instanceof Error ? err.message : String(err),
          },
        );
      }
    })();

    return { ok: true, summary: "queued" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;

function canvasToMarkdown(canvas: CanvasState): string {
  const parts: string[] = [];
  if (canvas.title) parts.push(`# ${canvas.title}`);
  for (const section of canvas.sections) {
    if (section.heading) parts.push(`## ${section.heading}`);
    for (const paragraph of section.paragraphs) parts.push(paragraph);
    for (const bullet of section.bullets) parts.push(`- ${bullet}`);
    for (const quote of section.quotes) parts.push(`> ${quote.text}`);
    if (section.inlineImages) {
      for (const image of section.inlineImages) {
        parts.push(`![${image.alt}](${image.url})`);
      }
    }
  }
  if (canvas.featuredImage) {
    parts.unshift(`![${canvas.featuredImage.alt}](${canvas.featuredImage.url})`);
  }
  return parts.join("\n\n");
}

function hashCanvas(canvas: CanvasState): string {
  return createHash("sha256")
    .update(canvasToMarkdown(canvas))
    .digest("hex")
    .slice(0, 12);
}
