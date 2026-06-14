import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  text: z.string().min(1),
  attributedTo: z.string().optional(),
});

/**
 * Records a verbatim quote on the most recently added section. The
 * writer worker preserves quotes verbatim and never paraphrases them,
 * so this tool is the only path that introduces verbatim speaker
 * language into the canvas.
 */
export default {
  name: "add_quote",
  description: "Mark a verbatim quote with attribution",
  category: "blocks",
  argsSchema,
  executionMode: "sync",
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("add_quote", args);
    return { ok: true, summary: "quote_added" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
