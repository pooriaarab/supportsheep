import { z } from "zod";
import type { Tool } from "./_types";
import { isSafeIframeSrc } from "./_embed-helpers";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  url: z
    .string()
    .url({ message: "url must be a valid URL" })
    .refine((u) => isSafeIframeSrc(u), {
      message:
        "url must be https:// and must not point to localhost / loopback / RFC1918 / link-local / cloud-metadata hosts",
    }),
});

const YOUTUBE_HOST_RE = /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;
const VIMEO_HOST_RE = /(?:^|\.)vimeo\.com$/i;

function detectKind(url: string): "youtube" | "iframe" {
  try {
    const u = new URL(url);
    if (YOUTUBE_HOST_RE.test(u.hostname)) return "youtube";
    if (VIMEO_HOST_RE.test(u.hostname)) return "iframe";
    return "iframe";
  } catch {
    return "iframe";
  }
}

/**
 * Insert a video into a section. Detects the host from the URL and
 * routes to the right embed kind:
 *
 *  - YouTube / youtu.be / youtube-nocookie → native YouTube embed
 *    (uses the TipTap `Youtube` extension via embed kind=youtube)
 *  - Vimeo / other allowlisted hosts → sandboxed iframe embed
 *
 * For pure-MP4 hosting prefer `insert_inline_image` with the file URL
 * — the editor only renders HTML5 `<video>` for hosted assets behind
 * the same Figure pipeline as images.
 */
export default {
  name: "insert_video",
  description:
    "Insert a video embed (YouTube, Vimeo, or other allowlisted iframe host) into a section. The kind is auto-detected from the URL host.",
  category: "embeds",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  dedupe: {
    keyFromArgs: (args) => `video:${args.url}`,
    windowMs: 60_000,
  },
  handler: (args, ctx) => {
    const kind = detectKind(args.url);
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "embed",
      kind,
      src: args.url,
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return {
      ok: true,
      data: { blockId, kind, src: args.url },
      summary: "video_embedded",
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
