import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema, type MarkRangeArgs } from "./_marks";

/**
 * Wraps the requested range with backticks for inline code. See
 * `_marks.ts` for the markdown-escape representation trade-off.
 */
export default {
  name: "apply_code",
  description: "Apply inline code formatting to a range of text inside a paragraph.",
  category: "marks",
  argsSchema: markRangeSchema,
  executionMode: "sync",
  perSessionCap: 200,
  handler: (args, ctx) =>
    applyMarkRange(args, ctx, (sel) => `\`${sel}\``, "code_applied"),
} satisfies Tool<MarkRangeArgs>;
