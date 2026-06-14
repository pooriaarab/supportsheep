import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  text: z.string().min(1),
});

/**
 * Appends a bullet to the most recently added section. Carrying over
 * the existing scaffold behaviour: if no section exists yet the call
 * is silently absorbed by the worker. Future Phase 2 will replace
 * this with a section-id-addressed `add_list_item` tool, but for
 * Phase 0 we preserve the exact pre-registry semantics so the model's
 * existing instructions still work.
 */
export default {
  name: "add_bullet",
  description: "Add a bullet to the current section",
  category: "section",
  argsSchema,
  executionMode: "sync",
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("add_bullet", args);
    return { ok: true, summary: "bullet_added" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
