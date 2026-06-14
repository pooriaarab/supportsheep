import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
});

/**
 * Insert a horizontal rule (`<hr>`) into a section. Used by the model
 * as a visual divider between subtopics. Counts against the Phase 4
 * blocks per-session cap of 30 like every other `insert_*` block.
 */
export default {
  name: "insert_divider",
  description: "Insert a horizontal rule divider into a section.",
  category: "blocks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "divider",
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId }, summary: "divider_inserted" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
