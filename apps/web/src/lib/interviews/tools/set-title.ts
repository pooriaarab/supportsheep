import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  title: z.string().min(1).max(200),
});

/**
 * Phase 2 — set the article title once the topic is clear. Replaces
 * the placeholder title that the writer-worker has been refining off
 * the transcript. Capped at 5 calls per session to discourage the
 * model from flip-flopping while the user is still describing the
 * topic.
 */
export default {
  name: "set_title",
  description:
    "Set the article title once the topic is clear. Use after the user has shared their topic.",
  category: "title-meta",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 5,
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("set_title", args);
    return { ok: true, summary: `title_set length=${args.title.length}` };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
