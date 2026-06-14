import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({}).strict();

/**
 * Returns a compact snapshot of the canvas: title, ordered section
 * ids+headings, finalized flags, and the SEO meta. Used by the model
 * to plan multi-step edits — e.g. "move section-3 after section-1" —
 * before issuing structural tool calls. We deliberately omit bullets
 * and paragraphs here so the model can keep the prompt context small;
 * `get_section` returns full contents for any specific id.
 */
export default {
  name: "get_current_state",
  description:
    "Read the current article canvas (title, section list, meta). Use to plan multi-step edits.",
  category: "read",
  argsSchema,
  executionMode: "sync",
  handler: (_args, ctx) => {
    const canvas = ctx.getCurrentCanvas();
    const summary = {
      title: canvas.title,
      sections: canvas.sections.map((s) => ({
        id: s.id,
        heading: s.heading,
        finalized: s.finalized,
        bulletCount: s.bullets.length,
        paragraphCount: s.paragraphs.length,
        quoteCount: s.quotes.length,
      })),
      meta: canvas.meta,
    };
    return {
      ok: true,
      data: summary,
      summary: `title=${canvas.title ? "set" : "unset"} sections=${canvas.sections.length}`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
