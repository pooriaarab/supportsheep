import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  paragraphId: z.string().min(1),
  fromSectionId: z.string().min(1),
  toSectionId: z.string().min(1),
  toIndex: z.number().int().min(0),
});

/**
 * Move a paragraph within a section or across sections. `toIndex` is
 * the destination slot in `toSectionId.paragraphs` after removal from
 * the source. The worker clamps out-of-range indices to the end of the
 * destination array — invalid section ids still surface as `not-found`.
 */
export default {
  name: "move_paragraph",
  description:
    "Move a paragraph to a different position within its section, or to another section",
  category: "paragraph",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const result = ctx.worker.moveParagraph(args);
    if (!result.ok) {
      return { ok: false, category: "not-found", message: result.reason };
    }
    return { ok: true, summary: "paragraph_moved" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
