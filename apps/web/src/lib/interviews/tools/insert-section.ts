import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  heading: z.string().min(1).max(200),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  afterSectionId: z.string().min(1).optional(),
});

/**
 * Phase 2 — insert a new section, optionally after a specific section
 * id (otherwise appended at the end). Replaces the scaffold-only
 * `add_heading` for the common case where the model needs to control
 * placement (e.g. to slot a new section between two existing ones).
 *
 * Returns the newly minted section id in the summary so the model can
 * immediately reference it on follow-up tool calls.
 */
export default {
  name: "insert_section",
  description:
    "Insert a new section with a heading, optionally after a specific section id. Returns the new section id.",
  category: "section",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 20,
  handler: (args, ctx) => {
    const before = ctx.getCurrentCanvas().sections.length;
    if (args.afterSectionId) {
      const exists = ctx
        .getCurrentCanvas()
        .sections.some((s) => s.id === args.afterSectionId);
      if (!exists) {
        return {
          ok: false,
          category: "not-found",
          message: `Section "${args.afterSectionId}" not found. Call get_current_state to list section ids.`,
        };
      }
    }
    ctx.worker.applyToolCall("insert_section", args);
    const after = ctx.getCurrentCanvas().sections;
    // The new section is either appended or inserted immediately after
    // `afterSectionId`. Recover its id from the diff between snapshots.
    if (after.length !== before + 1) {
      return {
        ok: false,
        category: "permanent",
        message: "Section was not inserted.",
      };
    }
    let newSection = after[after.length - 1];
    if (args.afterSectionId) {
      const idx = after.findIndex((s) => s.id === args.afterSectionId);
      if (idx !== -1 && idx + 1 < after.length) {
        newSection = after[idx + 1];
      }
    }
    return {
      ok: true,
      data: { sectionId: newSection.id },
      summary: `section_inserted id=${newSection.id}`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
