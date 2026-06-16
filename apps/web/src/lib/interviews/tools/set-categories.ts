import { z } from "zod";
import { listCategories } from "@/lib/categories/repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import type { Tool } from "./_types";

const CATEGORIES_MAX = 3;

const argsSchema = z.object({
  categoryIds: z.array(z.string().min(1).max(120)).min(1).max(CATEGORIES_MAX),
});

/**
 * Phase 5 — sync category assignment. Validates every id exists in
 * the `categories` collection before mutating canvas state — an
 * unknown id surfaces as a `validation` error so the model can
 * re-list available categories rather than persisting a dangling
 * reference.
 *
 * Three-category ceiling matches the publish-side UI: more than three
 * dilutes both navigation and the article's primary category signal.
 */
export default {
  name: "set_categories",
  description:
    "Assign categories to the article. Validates each id against the categories collection.",
  category: "seo",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 5,
  handler: async (args, ctx) => {
    const unique = Array.from(new Set(args.categoryIds.map((c) => c.trim()))).filter(
      Boolean,
    );
    if (unique.length === 0) {
      return {
        ok: false,
        category: "validation",
        message: "set_categories requires at least one category id",
      };
    }

    // Validate every id exists. Categories are addressed by slug in D1; one
    // list read covers the whole blog (category counts are small).
    const known = new Set(
      (await listCategories(DEFAULT_blog_id)).map((c) => c.slug),
    );
    const missing = unique.filter((id) => !known.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        category: "validation",
        message: `Unknown category id(s): ${missing.join(", ")}. List categories via the admin UI before retrying.`,
      };
    }

    ctx.worker.setCategories(unique);
    return {
      ok: true,
      summary: `categories_set count=${unique.length}`,
      data: { categoryIds: unique },
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
