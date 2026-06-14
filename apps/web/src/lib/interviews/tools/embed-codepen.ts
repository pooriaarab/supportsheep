import { z } from "zod";
import type { Tool } from "./_types";
import { CODEPEN_PEN_REGEX } from "./_embed-helpers";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  afterParagraphId: z.string().min(1).optional(),
  penId: z.string().regex(CODEPEN_PEN_REGEX, {
    message: "penId must be a 5-12 character CodePen pen id (alphanumeric).",
  }),
  defaultTab: z.enum(["html", "css", "js", "result"]).optional(),
});

/**
 * Embed a CodePen demo by pen id. The default tab controls which
 * panel is visible in the embed — `result` shows the rendered output
 * only; `html`/`css`/`js` show the matching source pane.
 *
 * The embed URL is constructed against `codepen.io` so the iframe
 * always points at the canonical host regardless of where the AI
 * thought the pen lived. We do not accept a full URL here — the
 * model passes the bare id (the part after `/pen/` in the share URL).
 */
export default {
  name: "embed_codepen",
  description:
    "Embed a CodePen demo by pen id. defaultTab selects which panel is visible: html, css, js, or result.",
  category: "embeds",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  dedupe: {
    keyFromArgs: (args) => `codepen:${args.penId}`,
    windowMs: 60_000,
  },
  handler: (args, ctx) => {
    const tab = args.defaultTab ?? "result";
    const src = `https://codepen.io/embed/${args.penId}?default-tab=${tab}`;
    const blockId = ctx.worker.insertBlock(args.sectionId, {
      type: "embed",
      kind: "codepen",
      src,
      attrs: { penId: args.penId, defaultTab: tab },
    });
    if (!blockId) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found. Call get_current_state to list available section ids.`,
      };
    }
    return { ok: true, data: { blockId, src }, summary: "codepen_embedded" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
