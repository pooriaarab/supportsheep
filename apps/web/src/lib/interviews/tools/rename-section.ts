import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  heading: z.string().min(1).max(200),
});

/**
 * Phase 2 — rename a section's heading without touching its content.
 * Use after a section has accumulated bullets/paragraphs and the
 * original heading no longer captures the topic.
 */
export default {
  name: "rename_section",
  description: "Rename a section's heading without changing its content.",
  category: "section",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
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
    ctx.worker.applyToolCall("rename_section", args);
    return { ok: true, summary: `section_renamed id=${args.sectionId}` };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
