import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { listPublishedArticles } from "@/lib/articles/repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import { emitFireAndForgetCompletion } from "./_narration-events";
import type { Tool } from "./_types";
import type {
  CanvasInternalLinkSuggestion,
  CanvasState,
} from "../writer-worker";

const log = createLogger("interviews:tools:suggest_internal_links");

const argsSchema = z.object({}).strict();

/**
 * Phase 5 — fire-and-forget internal-link suggestion. Surfaces
 * anchor opportunities by looking for title phrases of other
 * published articles inside the current canvas body. The result
 * lands on the canvas via the `internal_link_suggestions_updated`
 * diff so the editor sidebar can render an "apply" action that
 * funnels into `add_internal_link`.
 *
 * Capped at 4 calls per session and deduped on the canvas content
 * hash over 60s so the model can't burn cycles re-asking inside a
 * single turn.
 */
export default {
  name: "suggest_internal_links",
  description:
    "Suggest internal links to other published articles. Result arrives via the SSE stream.",
  category: "seo",
  argsSchema,
  executionMode: "fire-and-forget",
  perSessionCap: 4,
  dedupe: {
    keyFromArgs: () => "canvas-hash",
    windowMs: 60_000,
  },
  handler: (_args, ctx) => {
    const callId = `internal-links-${Date.now()}`;
    log.info("suggest_internal_links queued", {
      interviewId: ctx.interviewId,
      callId,
    });

    void (async () => {
      try {
        const canvas = ctx.getCurrentCanvas();
        const body = canvasBodyText(canvas).toLowerCase();
        // Use DEFAULT_blog_id: the interview tool context does not thread blogId
        // through the tool handler signature. Once multi-blog interview support
        // lands, blogId should be added to the tool context and threaded here.
        const { articles: publishedArticles } = await listPublishedArticles(
          DEFAULT_blog_id,
          { limit: 50 },
        );
        const suggestions: CanvasInternalLinkSuggestion[] = publishedArticles
          .flatMap((article) => {
            if (!article.slug || !article.title) return [];
            const titleKey = article.title.toLowerCase().slice(0, 20);
            if (!titleKey || !body.includes(titleKey)) return [];
            return [
              {
                phrase: article.title,
                targetSlug: article.slug,
                reason: "Title phrase appears in article body",
              },
            ];
          })
          .slice(0, 10);
        ctx.worker.setInternalLinkSuggestions(suggestions);
        log.info("suggest_internal_links background completed", {
          interviewId: ctx.interviewId,
          callId,
          count: suggestions.length,
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "suggest_internal_links",
          { ok: true, summary: `internal_link_suggestions=${suggestions.length}` },
        );
      } catch (err: unknown) {
        log.error("suggest_internal_links background failed", {
          interviewId: ctx.interviewId,
          callId,
          error: err instanceof Error ? err.message : String(err),
        });
        await emitFireAndForgetCompletion(
          ctx.interviewId,
          "suggest_internal_links",
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

function canvasBodyText(canvas: CanvasState): string {
  const parts: string[] = [];
  if (canvas.title) parts.push(canvas.title);
  for (const section of canvas.sections) {
    if (section.heading) parts.push(section.heading);
    parts.push(...section.paragraphs);
    parts.push(...section.bullets);
    for (const quote of section.quotes) parts.push(quote.text);
  }
  return parts.join(" ");
}
