import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema, type MarkRangeArgs } from "./_marks";

/**
 * Wraps the requested range with `**...**` so the canvas renderer
 * (and the eventual TipTap import) reads it as bold. See `_marks.ts`
 * for why Phase 3 stores marks as inline markdown escapes rather than
 * structured ProseMirror JSON.
 */
export default {
  name: "apply_bold",
  description: "Bold a range of text inside a paragraph.",
  category: "marks",
  argsSchema: markRangeSchema,
  executionMode: "sync",
  perSessionCap: 200,
  handler: (args, ctx) =>
    applyMarkRange(args, ctx, (sel) => `**${sel}**`, "bold_applied"),
} satisfies Tool<MarkRangeArgs>;
