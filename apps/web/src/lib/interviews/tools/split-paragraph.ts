import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  paragraphId: z.string().min(1),
  atOffset: z.number().int().min(1),
});

/**
 * Split a paragraph at a character offset into two paragraphs. The
 * head retains the original id; the tail receives a freshly minted id
 * which is returned in `summary` so the model can address it next.
 *
 * Validates `0 < offset < length` — offset 0 would be a no-op, and
 * offset == length is equivalent to inserting an empty paragraph.
 * Both cases surface as `validation` errors so the model retries with
 * a sensible offset rather than producing degenerate state.
 */
export default {
  name: "split_paragraph",
  description: "Split a paragraph at a character offset into two paragraphs",
  category: "paragraph",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const result = ctx.worker.splitParagraph(args);
    if (!result.ok) {
      // Use "validation" for bounds errors so the model retries with a
      // different offset rather than treating the paragraph as missing.
      const category = result.reason.includes("not found")
        ? "not-found"
        : "validation";
      return { ok: false, category, message: result.reason };
    }
    return {
      ok: true,
      data: { newParagraphId: result.newParagraphId },
      summary: result.newParagraphId,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
