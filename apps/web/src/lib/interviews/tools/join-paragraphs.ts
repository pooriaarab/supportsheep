import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  firstId: z.string().min(1),
  secondId: z.string().min(1),
});

/**
 * Concatenate two consecutive paragraphs into one using a single-space
 * separator. The resulting paragraph keeps `firstId`; `secondId` is
 * removed. The worker rejects non-adjacent or cross-section pairs so
 * the contract is unambiguous — no implicit reordering or merging
 * across structural boundaries.
 */
export default {
  name: "join_paragraphs",
  description:
    "Join two consecutive paragraphs (firstId followed by secondId) into one",
  category: "paragraph",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 30,
  handler: (args, ctx) => {
    const result = ctx.worker.joinParagraphs(args);
    if (!result.ok) {
      const category = result.reason.includes("not found")
        ? "not-found"
        : "validation";
      return { ok: false, category, message: result.reason };
    }
    return { ok: true, summary: "paragraphs_joined" };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;
