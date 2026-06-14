import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema, type MarkRangeArgs } from "./_marks";

/**
 * Wraps the requested range with `<sup>…</sup>` so the canvas
 * renderer (and TipTap's Superscript extension) treats it as a
 * superscript mark. Markdown has no native superscript syntax so we
 * use the HTML escape — TipTap parses it back to the Superscript
 * mark on import.
 */
export default {
  name: "apply_superscript",
  description: "Apply superscript to a range of text inside a paragraph.",
  category: "marks",
  argsSchema: markRangeSchema,
  executionMode: "sync",
  perSessionCap: 100,
  handler: (args, ctx) =>
    applyMarkRange(
      args,
      ctx,
      (sel) => `<sup>${sel}</sup>`,
      "superscript_applied",
    ),
} satisfies Tool<MarkRangeArgs>;
