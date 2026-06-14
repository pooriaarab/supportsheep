import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  text: z.string().min(1).max(250),
});

/**
 * Phase 2 — set the article subtitle. The subtitle frames the article
 * after the title is locked. Capped to discourage the model from
 * rewriting it on every conversational turn.
 */
export default {
  name: "set_subtitle",
  description:
    "Set the article subtitle (a short secondary line under the title).",
  category: "title-meta",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 5,
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("set_subtitle", { subtitle: args.text });
    return { ok: true, summary: `subtitle_set length=${args.text.length}` };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
