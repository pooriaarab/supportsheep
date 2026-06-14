import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  text: z.string().min(1),
  level: z.union([z.literal(2), z.literal(3)]).optional(),
});

/**
 * Phase 0 (Phase 1 of the migration plan in the catalog doc): the
 * existing scaffold tool, ported verbatim from `WriterWorker.applyToolCall`
 * so behaviour is identical. The handler delegates to the worker — the
 * worker remains the single source of truth for canvas mutations.
 *
 * Behaviour: appends a new section with the given heading. The worker
 * mints a stable `section-N` id and emits a `section_added` diff.
 */
export default {
  name: "add_heading",
  description: "Add a section heading to the article canvas",
  category: "section",
  argsSchema,
  executionMode: "sync",
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("add_heading", args);
    return { ok: true, summary: "section_added" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
