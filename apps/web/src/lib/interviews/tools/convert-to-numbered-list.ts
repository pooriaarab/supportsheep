import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  paragraphIds: z.array(z.string().min(1)).min(1),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Groups the given paragraphs into a `CanvasList` of kind `numbered`.
 * Maps to TipTap's `toggleOrderedList()` on canvas import.
 */
export default {
  name: "convert_to_numbered_list",
  description:
    "Group standalone paragraphs into a numbered (ordered) list inside the section.",
  category: "lists",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 50,
  handler: (args, ctx) => {
    const listId = ctx.worker.convertParagraphsToList(
      args.sectionId,
      args.paragraphIds,
      "numbered",
    );
    if (listId === null) {
      return {
        ok: false,
        category: "not-found",
        message: `Could not resolve section "${args.sectionId}" or any of its paragraphs.`,
      };
    }
    return {
      ok: true,
      data: { listId },
      summary: `numbered_list_created:${listId}`,
    };
  },
} satisfies Tool<Args>;
