import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  text: z.string().min(1),
});

/**
 * Append a paragraph to a section, or insert it immediately after a
 * specific paragraph id. Returns the new paragraph id in `summary`
 * so the model can address subsequent edits without round-tripping
 * through `get_section`.
 *
 * The writer-worker's background refinement loop continues to operate
 * on the same `paragraphs[]` array, so paragraphs the realtime model
 * inserts here may be rewritten in place by the next refinement pass
 * — that's by design (the model writes the rough idea; the writer
 * polishes it). The paragraph id is stable across that rewrite.
 *
 * When the requested `sectionId` is unknown — symptom of the realtime
 * model dispatching `insert_section` then `insert_paragraph` across
 * two POST batches that land on different serverless instances — the
 * worker recovers by minting an implicit "Untitled section" and
 * hosting the paragraph there. The new section id is echoed back as
 * `implicitSectionId` so the model can re-address subsequent edits
 * against it instead of the stale id.
 */
export default {
  name: "insert_paragraph",
  description:
    "Insert a paragraph into a section. Omit afterParagraphId to append at the end.",
  category: "paragraph",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 100,
  handler: (args, ctx) => {
    const result = ctx.worker.insertParagraph({
      sectionId: args.sectionId,
      afterParagraphId: args.afterParagraphId,
      text: args.text,
    });
    if (!result.ok) {
      return { ok: false, category: "not-found", message: result.reason };
    }
    if (result.implicitSectionId) {
      return {
        ok: true,
        data: {
          paragraphId: result.paragraphId,
          implicitSectionId: result.implicitSectionId,
        },
        summary: `${result.paragraphId} implicit_section=${result.implicitSectionId} reason=requested_section_not_found requested=${args.sectionId}`,
      };
    }
    return {
      ok: true,
      data: { paragraphId: result.paragraphId },
      summary: result.paragraphId,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
