import { z } from "zod";
import type { Tool } from "./_types";
import { ensureParagraphMetadata } from "./_paragraph-ids";

const argsSchema = z.object({
  section_id: z.string().min(1),
});

/**
 * Returns a single section's full contents (heading, bullets,
 * paragraphs, quotes, finalized flag). The model uses this before
 * targeted edits ("change the heading of section-2") to verify
 * what's actually on the canvas — otherwise it would guess based on
 * its own transcript memory, which drifts as the writer worker
 * refines bullets into prose.
 *
 * Returns `{ ok: false, category: "not-found" }` when the section
 * does not exist so the model can prompt the user to clarify rather
 * than retry with a different id.
 */
export default {
  name: "get_section",
  description:
    "Read a section's current heading, bullets, paragraphs, and quotes. Use before editing.",
  category: "read",
  argsSchema,
  executionMode: "sync",
  handler: (args, ctx) => {
    const canvas = ctx.getCurrentCanvas();
    const section = canvas.sections.find((s) => s.id === args.section_id);
    if (!section) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.section_id}" not found. Call get_current_state to list available section ids.`,
      };
    }
    // Surface preview ids for paragraphs that haven't been touched by
    // a tool yet so the model can still address them by id.
    ensureParagraphMetadata(section);
    return {
      ok: true,
      data: section,
      summary: `section ${section.id} (${section.bullets.length} bullets, ${section.paragraphs.length} paragraphs, ${section.quotes.length} quotes, finalized=${section.finalized})`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
