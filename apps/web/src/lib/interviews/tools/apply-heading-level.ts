import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  paragraphId: z.string().min(1),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Promote a paragraph into a new section heading at the requested
 * level. The verbal request "make this an h2" maps to a paragraph
 * → heading promotion: the source section is split at the paragraph,
 * its text becomes the new section's heading, and any paragraphs
 * that followed move into the new section as its body.
 *
 * H1 is reserved for the article title (`set_title`); valid levels
 * here are 2/3/4 to match `set_heading_level`'s section-level
 * mutation surface.
 */
export default {
  name: "apply_heading_level",
  description:
    "Promote a paragraph into a new section heading at the requested level (2, 3, or 4). Use when the user says 'make this an h2', 'turn this into a heading', etc.",
  category: "marks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 60,
  handler: (args, ctx) => {
    const result = ctx.worker.promoteParagraphToHeading({
      paragraphId: args.paragraphId,
      level: args.level,
    });
    if (!result.ok) {
      return {
        ok: false,
        category: "not-found",
        message: result.reason,
      };
    }
    return {
      ok: true,
      summary: `heading_promoted id=${result.newSectionId} level=${args.level}`,
      data: { newSectionId: result.newSectionId },
    };
  },
} satisfies Tool<Args>;
