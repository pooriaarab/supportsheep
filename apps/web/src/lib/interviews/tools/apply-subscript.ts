import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema, type MarkRangeArgs } from "./_marks";

/**
 * Wraps the requested range with `<sub>…</sub>` so the canvas
 * renderer (and TipTap's Subscript extension) treats it as a
 * subscript mark. Markdown has no native subscript syntax so we use
 * the HTML escape — TipTap parses it back to the Subscript mark on
 * import.
 */
export default {
  name: "apply_subscript",
  description: "Apply subscript to a range of text inside a paragraph.",
  category: "marks",
  argsSchema: markRangeSchema,
  executionMode: "sync",
  perSessionCap: 100,
  handler: (args, ctx) =>
    applyMarkRange(args, ctx, (sel) => `<sub>${sel}</sub>`, "subscript_applied"),
} satisfies Tool<MarkRangeArgs>;
