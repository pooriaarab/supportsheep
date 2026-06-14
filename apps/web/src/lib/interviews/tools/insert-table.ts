import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z
  .object({
    sectionId: z.string().min(1),
    afterParagraphId: z.string().min(1).optional(),
    rows: z.number().int().min(1).max(50),
    cols: z.number().int().min(1).max(20),
    headers: z.array(z.string().max(120)).max(20).optional(),
  })
  .refine(
    (v) => !v.headers || v.headers.length === v.cols,
    {
      message: "headers length must equal cols when provided",
      path: ["headers"],
    },
  );

/**
 * Insert an empty `rows × cols` table with an optional header row.
 * Caps at 50 rows × 20 columns to keep the realtime SSE diff small —
 * the catalog flagged 50 rows as a defensive upper bound that still
 * covers comparison tables, pricing matrices, and Notion-style data
 * shells.
 *
 * The table starts with empty cells; the writer-worker refines them
 * on subsequent passes based on transcript context. Headers are
 * provided up-front because the model usually states them
 * explicitly when it asks for a table.
 */
export default {
  name: "insert_table",
  description:
    "Insert an empty table of the given dimensions, optionally with a header row.",
  category: "blocks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "table",
      rows: args.rows,
      cols: args.cols,
      headers: args.headers,
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId }, summary: "table_inserted" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
