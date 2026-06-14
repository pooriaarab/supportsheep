import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  imageId: z.string().min(1),
  altText: z.string().min(1).max(150),
});

/**
 * Phase 5 — sync accessibility update. Sets the alt text on an
 * existing image (featured or inline). Returns `not-found` if the
 * image id is unknown so the model can call `get_current_state` to
 * re-orient. Max 150 chars per WCAG guidance for non-functional
 * images.
 */
export default {
  name: "set_alt_text",
  description:
    "Update the accessibility alt text on an existing image. Max 150 characters.",
  category: "images",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 50,
  handler: (args, ctx) => {
    const image = ctx.worker.setImageAlt(args.imageId, args.altText);
    if (!image) {
      return {
        ok: false,
        category: "not-found",
        message: `Image "${args.imageId}" not found. Call get_current_state to list current images.`,
      };
    }
    return { ok: true, summary: "image_alt_updated" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
