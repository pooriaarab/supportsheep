import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  listId: z.string().min(1),
  itemId: z.string().min(1),
  checked: z.boolean(),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Toggles a checklist item's completion. Only valid when the parent
 * list is of kind `checklist`. Returns `not-found` when the list or
 * item is unknown, or when the list is not a checklist.
 */
export default {
  name: "complete_list_item",
  description: "Mark a checklist item as completed or uncompleted.",
  category: "lists",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 50,
  handler: (args, ctx) => {
    const ok = ctx.worker.completeListItem(
      args.listId,
      args.itemId,
      args.checked,
    );
    if (!ok) {
      return {
        ok: false,
        category: "not-found",
        message: `Could not toggle item "${args.itemId}" in list "${args.listId}" (list may not be a checklist).`,
      };
    }
    return {
      ok: true,
      summary: `item_${args.checked ? "checked" : "unchecked"}`,
    };
  },
} satisfies Tool<Args>;
