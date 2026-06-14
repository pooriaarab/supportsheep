import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
});

/**
 * Phase 2 — remove a section by id. Destructive: also drops the
 * section's bullets, paragraphs, and quotes. The model should call
 * `get_section` first when the user retracts an entire topic.
 *
 * Returns `not-found` (not silent absorb) so the model can recover
 * by listing ids via `get_current_state`.
 */
export default {
  name: "delete_section",
  description:
    "Delete a section by id. Drops the section's content. Confirm with the user before calling.",
  category: "section",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  handler: (args, ctx) => {
    const exists = ctx
      .getCurrentCanvas()
      .sections.some((s) => s.id === args.sectionId);
    if (!exists) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${args.sectionId}" not found.`,
      };
    }
    ctx.worker.applyToolCall("delete_section", args);
    return { ok: true, summary: `section_deleted id=${args.sectionId}` };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
