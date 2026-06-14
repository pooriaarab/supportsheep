import { z } from "zod";
import type { Tool } from "./_types";
import { YOUTUBE_ID_REGEX } from "./_embed-helpers";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  videoId: z.string().regex(YOUTUBE_ID_REGEX, {
    message:
      "videoId must be an 11-character YouTube id (base64url). Pass the id only, not the full URL.",
  }),
  startSeconds: z.number().int().min(0).max(60_000).optional(),
});

/**
 * Embed a YouTube video by id. The id (not the full URL) is required
 * so we construct the canonical `https://www.youtube-nocookie.com/embed/<id>`
 * URL ourselves — preventing the model from sneaking in tracking
 * parameters or pointing the iframe at an unrelated host.
 *
 * Deduped on `videoId` over a 60s window so an accidental retry from
 * the realtime stream doesn't insert the same video twice.
 */
export default {
  name: "embed_youtube",
  description:
    "Embed a YouTube video by id (not URL) at the end of a section. Optional startSeconds skips to a timestamp.",
  category: "embeds",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  dedupe: {
    keyFromArgs: (args) => `youtube:${args.videoId}`,
    windowMs: 60_000,
  },
  handler: (args, ctx) => {
    const params = new URLSearchParams();
    if (args.startSeconds !== undefined) {
      params.set("start", String(args.startSeconds));
    }
    const query = params.toString();
    const src = `https://www.youtube-nocookie.com/embed/${args.videoId}${query ? `?${query}` : ""}`;
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "embed",
      kind: "youtube",
      src,
      attrs: { videoId: args.videoId, startSeconds: args.startSeconds },
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId, src }, summary: "youtube_embedded" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
