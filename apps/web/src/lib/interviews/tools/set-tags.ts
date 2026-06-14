import { z } from "zod";
import type { Tool } from "./_types";

const TAG_MAX_CHARS = 64;
const TAGS_MAX = 8;

const argsSchema = z.object({
  tagNames: z
    .array(z.string().min(1).max(TAG_MAX_CHARS))
    .max(TAGS_MAX),
});

/**
 * Phase 5 — sync tag assignment. Auto-creates any tag name that
 * isn't already present (the publish-side tag collection materialises
 * on first use), so the model can volunteer fresh tags during a
 * voice interview without needing a pre-population step.
 *
 * The eight-tag ceiling matches the editor sidebar's visible row
 * count — beyond that they're truncated anyway.
 */
export default {
  name: "set_tags",
  description:
    "Assign tags to the article (auto-created if not present). Max 8 tags, 64 chars each.",
  category: "seo",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  handler: (args, ctx) => {
    const normalized = Array.from(
      new Set(args.tagNames.map((t) => t.trim().toLowerCase())),
    ).filter(Boolean);
    ctx.worker.setTags(normalized);
    return {
      ok: true,
      summary: `tags_set count=${normalized.length}`,
      data: { tagNames: normalized },
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
