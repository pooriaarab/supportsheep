import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  toIndex: z.number().int().min(0),
});

/**
 * Phase 2 — reorder a section by id to a target zero-based index.
 * `toIndex` is clamped into the post-removal range, so passing a very
 * large index moves the section to the end. Index 0 moves to top.
 */
export default {
  name: "move_section",
  description:
    "Move a section to a new zero-based index. Use to reorder for narrative flow.",
  category: "section",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const exists = ctx
      .getCurrentCanvas()
      .sections.some((s) => s.id === args.sectionId);
    if (!exists) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found.`,
      };
    }
    ctx.worker.applyToolCall("move_section", args);
    const order = ctx.getCurrentCanvas().sections.map((s) => s.id);
    const newIdx = order.indexOf(args.sectionId);
    return {
      ok: true,
      data: { sectionId: args.sectionId, index: newIdx, order },
      summary: `section_moved id=${args.sectionId} index=${newIdx}`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
