import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema, type MarkRangeArgs } from "./_marks";

/**
 * Wraps the requested range with `<u>...</u>` because markdown has no
 * native underline syntax. The HTML is sanitized downstream by
 * `sanitizeArticleHtml` before publishing. See `_marks.ts`.
 */
export default {
  name: "apply_underline",
  description: "Underline a range of text inside a paragraph.",
  category: "marks",
  argsSchema: markRangeSchema,
  executionMode: "sync",
  perSessionCap: 200,
  handler: (args, ctx) =>
    applyMarkRange(args, ctx, (sel) => `<u>${sel}</u>`, "underline_applied"),
} satisfies Tool<MarkRangeArgs>;
