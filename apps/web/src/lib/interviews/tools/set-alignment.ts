import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  paragraphId: z.string().min(1),
  alignment: z.enum(["left", "center", "right", "justify"]),
});

/**
 * Set the horizontal alignment for a paragraph. Persists onto the
 * canvas via the optional `paragraphAlignments` array — `undefined`
 * slots fall back to the editor default ("left") so existing canvases
 * that never received an alignment tool call stay untouched.
 */
export default {
  name: "set_alignment",
  description: "Set the alignment (left, center, right, justify) on a paragraph",
  category: "paragraph",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 50,
  handler: (args, ctx) => {
    const result = ctx.worker.setParagraphAlignment(args);
    if (!result.ok) {
      return { ok: false, category: "not-found", message: result.reason };
    }
    return { ok: true, summary: `alignment_${args.alignment}` };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
