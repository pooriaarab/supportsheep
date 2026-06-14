import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  paragraphId: z.string().min(1),
});

/**
 * Remove a paragraph by id. Destructive — the catalog instructs the
 * realtime system prompt to confirm with the speaker before issuing
 * a delete on content the writer-worker already refined. Returns a
 * structured `not-found` error rather than silently no-op'ing so the
 * model can surface that the id is stale.
 */
export default {
  name: "delete_paragraph",
  description: "Delete a paragraph from a section by id",
  category: "paragraph",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 50,
  handler: (args, ctx) => {
    const result = ctx.worker.deleteParagraph({
      sectionId: args.sectionId,
      paragraphId: args.paragraphId,
    });
    if (!result.ok) {
      return { ok: false, category: "not-found", message: result.reason };
    }
    return { ok: true, summary: "paragraph_deleted" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
