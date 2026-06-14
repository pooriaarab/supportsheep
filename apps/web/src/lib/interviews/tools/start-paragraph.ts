import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  hint: z.string().optional(),
});

/**
 * Marker-only tool — the realtime model uses this to tell the writer
 * worker "a new paragraph is incoming, refine bullets into prose on
 * the next pass." Pre-registry, the worker's switch statement was a
 * deliberate no-op; we preserve that behaviour here so the writer's
 * refinement pipeline keeps owning paragraph composition.
 */
export default {
  name: "start_paragraph",
  description:
    "Begin a new paragraph; the writer worker will refine the content",
  category: "paragraph",
  argsSchema,
  executionMode: "sync",
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("start_paragraph", args);
    return { ok: true, summary: "paragraph_started" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
