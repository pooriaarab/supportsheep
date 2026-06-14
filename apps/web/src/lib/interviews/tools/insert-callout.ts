import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  kind: z.enum(["info", "warning", "success", "danger"]),
  title: z.string().max(120).optional(),
  body: z.string().min(1).max(1_500),
});

/**
 * Insert a Notion-style callout block — a sidebar-emphasis block
 * with one of four visual tones (`info` / `warning` / `success` /
 * `danger`). The four kinds match the public renderer's CSS
 * `aside.callout--{kind}` styles in `globals.css` and the TipTap
 * `Callout` node's variant attribute (`tip` and `note` upstream map
 * to `success`/`info` here — the realtime catalog uses the
 * publicly-known kind names per the design doc).
 */
export default {
  name: "insert_callout",
  description:
    "Insert a callout block (info, warning, success, or danger) with optional title.",
  category: "blocks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "callout",
      kind: args.kind,
      title: args.title,
      body: args.body,
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId }, summary: "callout_inserted" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
