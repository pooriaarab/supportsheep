import { z } from "zod";
import type { Tool } from "./_types";

const KEYWORD_MAX_CHARS = 50;
const KEYWORDS_MAX = 10;

const argsSchema = z.object({
  keywords: z
    .array(z.string().min(1).max(KEYWORD_MAX_CHARS))
    .max(KEYWORDS_MAX),
});

/**
 * Phase 5 — sync SEO keyword set. Replaces the article's keyword
 * list with the supplied array. The catalog caps the list at 10
 * keywords with 50 chars each — beyond that the keyword density
 * heuristic loses its signal and the editor sidebar truncates
 * anyway.
 */
export default {
  name: "set_keywords",
  description:
    "Replace the article SEO keyword list. Max 10 keywords, each up to 50 characters.",
  category: "seo",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 10,
  handler: (args, ctx) => {
    const deduped = Array.from(new Set(args.keywords.map((k) => k.trim()))).filter(
      Boolean,
    );
    ctx.worker.setKeywords(deduped);
    return {
      ok: true,
      summary: `keywords_set count=${deduped.length}`,
      data: { keywords: deduped },
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
