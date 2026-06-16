import { z } from "zod";
import { getArticleBySlug } from "@/lib/articles/repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import type { Tool } from "./_types";

const argsSchema = z.object({
  paragraphId: z.string().min(1).max(120),
  sectionId: z.string().min(1).max(64),
  range: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }),
  targetSlug: z.string().min(1).max(300),
});

/**
 * Phase 5 — sync internal-link application. Wraps a paragraph
 * substring in a `<a href="/blog/<slug>">` mark. The target slug is
 * validated against the `articles` collection before mutating canvas
 * state so a typo from the model never lands a dead link on the
 * canvas.
 *
 * `range` is a `{ start, end }` character offset against the
 * paragraph text. Out-of-bounds ranges surface as validation errors;
 * the model can call `get_section` first to confirm the paragraph
 * text.
 */
export default {
  name: "add_internal_link",
  description:
    "Add an internal link mark on a paragraph range. Validates the target slug exists.",
  category: "seo",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: async (args, ctx) => {
    if (args.range.end <= args.range.start) {
      return {
        ok: false,
        category: "validation",
        message: "range.end must be greater than range.start",
      };
    }

    // Validate the slug points at a published article (D1). Keeps a dead
    // link from ever landing on the canvas from a model typo.
    const article = await getArticleBySlug(DEFAULT_blog_id, args.targetSlug);
    if (!article || article.status !== "published") {
      return {
        ok: false,
        category: "validation",
        message: `No published article with slug "${args.targetSlug}". Suggest a valid slug via suggest_internal_links.`,
      };
    }

    const added = ctx.worker.addInternalLink({
      sectionId: args.sectionId,
      paragraphId: args.paragraphId,
      range: args.range,
      targetSlug: args.targetSlug,
    });
    if (!added) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found.`,
      };
    }
    return {
      ok: true,
      summary: `internal_link_added section=${args.sectionId} slug=${args.targetSlug}`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
