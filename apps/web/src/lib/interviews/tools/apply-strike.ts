import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema, type MarkRangeArgs } from "./_marks";

/**
 * Wraps the requested range with `~~...~~` for strikethrough. See
 * `_marks.ts`.
 */
export default {
  name: "apply_strike",
  description: "Strike through a range of text inside a paragraph.",
  category: "marks",
  argsSchema: markRangeSchema,
  executionMode: "sync",
  perSessionCap: 200,
  handler: (args, ctx) =>
    applyMarkRange(args, ctx, (sel) => `~~${sel}~~`, "strike_applied"),
} satisfies Tool<MarkRangeArgs>;
