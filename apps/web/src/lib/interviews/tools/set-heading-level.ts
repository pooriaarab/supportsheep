import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});

/**
 * Phase 2 — promote or demote a section's heading level between H2,
 * H3, and H4. Use when the model wants to express a nested
 * sub-section under a parent topic without restructuring the canvas.
 */
export default {
  name: "set_heading_level",
  description:
    "Change a section's heading level (2, 3, or 4). Use to nest a section under a parent topic.",
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
    ctx.worker.applyToolCall("set_heading_level", args);
    return {
      ok: true,
      summary: `heading_level_set id=${args.sectionId} level=${args.level}`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
