import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema, type MarkRangeArgs } from "./_marks";

/**
 * Wraps the requested range with `*...*` for italic. See `_marks.ts`
 * for the trade-off explanation around markdown escapes vs ProseMirror
 * JSON.
 */
export default {
  name: "apply_italic",
  description: "Italicise a range of text inside a paragraph.",
  category: "marks",
  argsSchema: markRangeSchema,
  executionMode: "sync",
  perSessionCap: 200,
  handler: (args, ctx) =>
    applyMarkRange(args, ctx, (sel) => `*${sel}*`, "italic_applied"),
} satisfies Tool<MarkRangeArgs>;
