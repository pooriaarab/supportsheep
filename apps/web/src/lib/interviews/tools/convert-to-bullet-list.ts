import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  paragraphIds: z.array(z.string().min(1)).min(1),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Groups the given paragraphs into a `CanvasList` of kind `bullet`,
 * removing them from `section.paragraphs[]`. Maps to TipTap's
 * `toggleBulletList()` when the canvas is imported into the editor.
 */
export default {
  name: "convert_to_bullet_list",
  description:
    "Group standalone paragraphs into a bullet list inside the section.",
  category: "lists",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 50,
  handler: (args, ctx) => {
    const listId = ctx.worker.convertParagraphsToList(
      args.sectionId,
      args.paragraphIds,
      "bullet",
    );
    if (listId === null) {
      return {
        ok: false,
        category: "not-found",
        message: `Could not resolve section "${args.sectionId}" or any of its paragraphs.`,
      };
    }
    return { ok: true, data: { listId }, summary: `bullet_list_created:${listId}` };
  },
} satisfies Tool<Args>;
