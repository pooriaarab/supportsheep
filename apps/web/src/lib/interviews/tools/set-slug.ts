import { z } from "zod";
import type { Tool } from "./_types";

// Lowercase letters, digits, and hyphens — the same shape every blog
// route + sitemap generator already assumes. Reject anything else at
// validation time rather than silently coercing.
const SLUG_REGEX = /^[a-z0-9-]+$/;

const argsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(SLUG_REGEX, "slug must match /^[a-z0-9-]+$/"),
});

/**
 * Phase 2 — lock the URL slug once the title is stable. The handler
 * delegates to the worker so canvas state is the single source of
 * truth; slug uniqueness is enforced later at publish time, not here.
 */
export default {
  name: "set_slug",
  description: "Set the URL slug for the article. Use kebab-case (lowercase letters, digits, hyphens).",
  category: "title-meta",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 5,
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("set_slug", args);
    return { ok: true, summary: `slug_set ${args.slug}` };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
