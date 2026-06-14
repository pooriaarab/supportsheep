import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
});

/**
 * Marks a section as `finalized: true`. The writer worker stops
 * proposing refinement diffs for finalized sections, so the model
 * uses this once a section reads as publish-ready. If the
 * `sectionId` is unknown the worker silently absorbs the call —
 * we preserve that pre-registry behaviour rather than returning
 * a `not-found` error so existing model prompts continue working
 * unchanged. Future read-tools let the model verify ids first.
 */
export default {
  name: "finalize_section",
  description: "Mark a section as finalized so the writer worker locks it",
  category: "section",
  argsSchema,
  executionMode: "sync",
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("finalize_section", args);
    return { ok: true, summary: "section_finalized" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
