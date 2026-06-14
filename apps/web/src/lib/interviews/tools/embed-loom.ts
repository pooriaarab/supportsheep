import { z } from "zod";
import type { Tool } from "./_types";
import { LOOM_ID_REGEX } from "./_embed-helpers";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  videoId: z.string().regex(LOOM_ID_REGEX, {
    message:
      "videoId must be a Loom video id (hex string, 16-64 characters).",
  }),
});

/**
 * Embed a Loom walkthrough video by id. We construct the iframe URL
 * ourselves (`https://www.loom.com/embed/{id}`) so the model can only
 * point at Loom's canonical embed host.
 */
export default {
  name: "embed_loom",
  description: "Embed a Loom video walkthrough by video id.",
  category: "embeds",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  dedupe: {
    keyFromArgs: (args) => `loom:${args.videoId}`,
    windowMs: 60_000,
  },
  handler: (args, ctx) => {
    const src = `https://www.loom.com/embed/${args.videoId}`;
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "embed",
      kind: "loom",
      src,
      attrs: { videoId: args.videoId },
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId, src }, summary: "loom_embedded" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
