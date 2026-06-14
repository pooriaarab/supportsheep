import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  paragraphId: z.string().min(1),
  oldText: z.string().min(1),
  newText: z.string(),
});

/**
 * Exact-match string replace within a paragraph. The model uses this
 * for live corrections ("change 'fast' to 'rapid'") instead of
 * rewriting the entire paragraph through the writer-worker — keeps
 * latency low and avoids triggering a full refinement pass.
 *
 * Returns `not-found` when `oldText` is absent from the addressed
 * paragraph so the model can ask the speaker to clarify rather than
 * guess at a different replacement.
 */
export default {
  name: "replace_text",
  description: "Replace exact text within a paragraph",
  category: "paragraph",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 100,
  handler: (args, ctx) => {
    const result = ctx.worker.replaceParagraphText(args);
    if (!result.ok) {
      return { ok: false, category: "not-found", message: result.message };
    }
    return { ok: true, summary: "text_replaced" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
