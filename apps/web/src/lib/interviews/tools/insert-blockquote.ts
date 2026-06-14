import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  text: z.string().min(1).max(2_000),
  attribution: z.string().max(200).optional(),
});

/**
 * Insert a block-level pull-quote into a section. Unlike `add_quote`,
 * which records a verbatim speaker utterance with attribution, this
 * tool is used by the model when it wants to surface an editorial
 * quote (a notable phrase, a citation, a sidebar pull-out) as a
 * standalone block. The attribution is rendered as a `<cite>` line.
 *
 * Counted against the Phase 4 blocks per-session cap of 30 — shared
 * across all five `insert_*` block tools — to prevent the AI from
 * flooding the canvas with decorative blocks.
 */
export default {
  name: "insert_blockquote",
  description:
    "Insert a pull-quote block with optional attribution into a section.",
  category: "blocks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "blockquote",
      text: args.text,
      attribution: args.attribution,
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId }, summary: "blockquote_inserted" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
