import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  listId: z.string().min(1),
  text: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Inserts a new item into an existing list at the given zero-based
 * position. Omitting `position` appends. Returns `not-found` when the
 * list id is unknown.
 */
export default {
  name: "add_list_item",
  description:
    "Insert a new item into an existing list at the given position (appends when position is omitted).",
  category: "lists",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 50,
  handler: (args, ctx) => {
    const itemId = ctx.worker.addListItem(args.listId, args.text, {
      position: args.position,
    });
    if (itemId === null) {
      return {
        ok: false,
        category: "not-found",
        message: `List "${args.listId}" not found.`,
      };
    }
    return { ok: true, data: { itemId }, summary: `item_added:${itemId}` };
  },
} satisfies Tool<Args>;
