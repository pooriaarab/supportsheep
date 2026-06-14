import { z } from "zod";
import type { Tool } from "./_types";
import { isSafeIframeSrc } from "./_embed-helpers";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  src: z
    .string()
    .url({ message: "src must be a valid URL" })
    .refine(isSafeIframeSrc, {
      message:
        "src must be https://, must not point to localhost / loopback / RFC1918 / link-local / cloud-metadata hosts, and must not use the data:, javascript:, or file: schemes.",
    }),
  height: z.number().int().min(120).max(2_000).optional(),
});

/**
 * Generic iframe embed. **Prefer the named embed tools (`embed_youtube`,
 * `embed_tweet`, `embed_codepen`, `embed_gist`, `embed_loom`) when the
 * content type matches** — those tools validate the source against
 * provider-specific allowlists and construct trusted iframe URLs.
 * This generic tool exists for the rare case of an allowlist-safe
 * external embed (Figma file, Notion page, etc.).
 *
 * Security: `src` is validated by `isSafeIframeSrc(...)` to enforce
 * https://, block loopback/RFC1918/link-local/cloud-metadata hosts,
 * and reject the `data:`, `javascript:`, and `file:` schemes. The
 * rendered iframe wrapper applies `sandbox="allow-scripts
 * allow-same-origin"` and `referrerpolicy="no-referrer"` so the
 * embed cannot navigate the host, open popups, submit forms, or
 * leak the parent URL.
 */
export default {
  name: "embed_iframe",
  description:
    "Embed an arbitrary external page in a sandboxed iframe. Prefer named embed tools (youtube/tweet/codepen/gist/loom) when possible. src must be https:// and is rejected for localhost, loopback, RFC1918, link-local, cloud-metadata, data:, javascript:, or file: URLs.",
  category: "embeds",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  dedupe: {
    keyFromArgs: (args) => `iframe:${args.src}`,
    windowMs: 60_000,
  },
  handler: (args, ctx) => {
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "embed",
      kind: "iframe",
      src: args.src,
      attrs: { height: args.height },
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId, src: args.src }, summary: "iframe_embedded" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
