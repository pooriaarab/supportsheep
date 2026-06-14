import { z } from "zod";
import type { Tool } from "./_types";
import { GIST_ID_REGEX } from "./_embed-helpers";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  gistId: z.string().regex(GIST_ID_REGEX, {
    message: "gistId must be a hex string between 8 and 40 characters.",
  }),
  /** Specific file in a multi-file gist (no extension). */
  file: z.string().max(200).optional(),
});

/**
 * Embed a GitHub gist by id. We construct the iframe URL ourselves
 * (`https://gist.github.com/{id}.pibb`) so the model can only point
 * at gist.github.com. The optional `file` parameter scopes the embed
 * to a single file in a multi-file gist.
 */
export default {
  name: "embed_gist",
  description:
    "Embed a GitHub gist by id. Optional file scopes the embed to a single file within a multi-file gist.",
  category: "embeds",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  dedupe: {
    keyFromArgs: (args) => `gist:${args.gistId}:${args.file ?? ""}`,
    windowMs: 60_000,
  },
  handler: (args, ctx) => {
    const params = new URLSearchParams();
    if (args.file) params.set("file", args.file);
    const query = params.toString();
    const src = `https://gist.github.com/${args.gistId}.pibb${query ? `?${query}` : ""}`;
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "embed",
      kind: "gist",
      src,
      attrs: { gistId: args.gistId, file: args.file },
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId, src }, summary: "gist_embedded" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
