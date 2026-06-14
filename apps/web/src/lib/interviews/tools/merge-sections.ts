import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z
  .object({
    fromSectionId: z.string().min(1),
    intoSectionId: z.string().min(1),
  })
  .refine((v) => v.fromSectionId !== v.intoSectionId, {
    message: "fromSectionId and intoSectionId must be different.",
  });

/**
 * Phase 2 — merge `fromSectionId` into `intoSectionId`: append the
 * source's bullets, paragraphs, and quotes onto the target, then
 * delete the source. Destructive — the source section's id is gone.
 * The target's heading is kept; the model can rename it after with
 * `rename_section` if the merged content needs a fresh framing.
 */
export default {
  name: "merge_sections",
  description:
    "Merge one section's content into another. Source bullets/paragraphs/quotes are appended; source section is deleted.",
  category: "section",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  handler: (args, ctx) => {
    const canvas = ctx.getCurrentCanvas();
    const fromExists = canvas.sections.some((s) => s.id === args.fromSectionId);
    const intoExists = canvas.sections.some((s) => s.id === args.intoSectionId);
    if (!fromExists || !intoExists) {
      const missing = [
        !fromExists ? args.fromSectionId : null,
        !intoExists ? args.intoSectionId : null,
      ]
        .filter(Boolean)
        .join(", ");
      return {
        ok: false,
        category: "not-found",
        message: `Section(s) not found: ${missing}.`,
      };
    }
    ctx.worker.applyToolCall("merge_sections", args);
    return {
      ok: true,
      data: { sectionId: args.intoSectionId },
      summary: `sections_merged from=${args.fromSectionId} into=${args.intoSectionId}`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
