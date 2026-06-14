import { z } from "zod";
import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema } from "./_marks";

const argsSchema = markRangeSchema.extend({
  color: z.enum(["yellow", "pink", "green"]).default("yellow"),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Wraps the requested range with `<mark data-color="…">…</mark>`. The
 * three colours mirror TipTap's Highlight (multicolor) extension
 * presets. Markdown has no highlight syntax so we fall back to HTML;
 * `sanitizeArticleHtml` keeps these tags through publish.
 */
export default {
  name: "apply_highlight",
  description: "Highlight a range of text inside a paragraph (yellow, pink, or green).",
  category: "marks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 200,
  handler: (args, ctx) =>
    applyMarkRange(
      { sectionId: args.sectionId, paragraphId: args.paragraphId, range: args.range },
      ctx,
      (sel) => `<mark data-color="${args.color}">${sel}</mark>`,
      "highlight_applied",
    ),
} satisfies Tool<Args>;
