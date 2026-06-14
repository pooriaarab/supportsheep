import { z } from "zod";
import type { Tool } from "./_types";
import { applyMarkRange, markRangeSchema } from "./_marks";

const argsSchema = markRangeSchema.extend({
  url: z
    .string()
    .min(1)
    .url()
    .refine(
      (v) => /^https?:\/\//i.test(v),
      "Only http and https URLs are allowed.",
    ),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Wraps the requested range with markdown link syntax
 * `[text](url)`. See `_marks.ts` for the representation trade-off.
 */
export default {
  name: "apply_link",
  description: "Wrap a range of text inside a paragraph with a hyperlink.",
  category: "marks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 200,
  handler: (args, ctx) =>
    applyMarkRange(
      { sectionId: args.sectionId, paragraphId: args.paragraphId, range: args.range },
      ctx,
      (sel) => `[${sel}](${args.url})`,
      "link_applied",
    ),
} satisfies Tool<Args>;
