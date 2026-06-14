import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z
  .object({
    metaTitle: z.string().min(1).max(70).optional(),
    metaDescription: z.string().min(1).max(160).optional(),
  })
  .refine(
    (v) => v.metaTitle !== undefined || v.metaDescription !== undefined,
    {
      message: "At least one of metaTitle or metaDescription is required.",
    },
  );

/**
 * Phase 2 — set SEO meta-title and meta-description used in the
 * `<title>` tag and `<meta name="description">` of the published
 * article. Distinct from the human-facing title so the AI can tune
 * search snippets without disturbing the article's display title.
 */
export default {
  name: "set_seo_meta",
  description:
    "Set the SEO meta title and/or meta description. Use after at least one section is finalized.",
  category: "title-meta",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 3,
  handler: (args, ctx) => {
    ctx.worker.applyToolCall("set_seo_meta", args);
    const parts: string[] = [];
    if (args.metaTitle !== undefined) parts.push(`title=${args.metaTitle.length}`);
    if (args.metaDescription !== undefined) parts.push(`desc=${args.metaDescription.length}`);
    return { ok: true, summary: `seo_meta_set ${parts.join(" ")}` };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
