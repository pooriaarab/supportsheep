import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  listId: z.string().min(1),
  itemId: z.string().min(1),
  direction: z.enum(["in", "out"]),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Indents (`"in"`) or outdents (`"out"`) a list item. Mirrors TipTap's
 * `sinkListItem` / `liftListItem`. Returns `not-found` when the list
 * or item is unknown, or when the item is already at the outer-/
 * inner-most level for the requested direction.
 */
export default {
  name: "nest_list_item",
  description: "Indent or outdent a list item.",
  category: "lists",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 50,
  handler: (args, ctx) => {
    const ok = ctx.worker.nestListItem(args.listId, args.itemId, args.direction);
    if (!ok) {
      return {
        ok: false,
        category: "not-found",
        message: `Could not nest item "${args.itemId}" in list "${args.listId}".`,
      };
    }
    return { ok: true, summary: `item_nested:${args.direction}` };
  },
} satisfies Tool<Args>;
