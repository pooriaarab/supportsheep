import { z } from "zod";
import type { Tool } from "./_types";
import type { CanvasSection } from "../writer-worker";

const argsSchema = z.object({
  target: z.string().optional(),
});

/**
 * Returns word + character counts so the model can pace the
 * interview ("aim for 800 words"). `target` defaults to "all";
 * any other value is interpreted as a section id. We accept a
 * free-form string for `target` (rather than a discriminated
 * union) because OpenAI Realtime's tool-call serialization
 * collapses both shapes — the legacy `{"all"}` and a section id —
 * into the same JSON Schema, and the model is consistently better
 * at supplying a single string field.
 *
 * Counts are derived from canvas state — quotes count as words
 * (they're part of the published article), the heading is not
 * (UI surfaces it separately).
 */
export default {
  name: "get_word_count",
  description:
    "Count words in the article. Pass a section id to scope to one section; omit for the whole article.",
  category: "read",
  argsSchema,
  executionMode: "sync",
  handler: (args, ctx) => {
    const canvas = ctx.getCurrentCanvas();
    const target = args.target?.trim();

    if (!target || target === "all") {
      let words = 0;
      let characters = 0;
      for (const section of canvas.sections) {
        const counts = countSection(section);
        words += counts.words;
        characters += counts.characters;
      }
      return {
        ok: true,
        data: { scope: "all", words, characters },
        summary: `total words=${words}`,
      };
    }

    const section = canvas.sections.find((s) => s.id === target);
    if (!section) {
      return {
        ok: false,
        category: "not-found",
        message: `Section "${target}" not found. Pass a valid section id or omit to count the whole article.`,
      };
    }
    const { words, characters } = countSection(section);
    return {
      ok: true,
      data: { scope: section.id, words, characters },
      summary: `section ${section.id} words=${words}`,
    };
  },
} satisfies Tool<z.infer<typeof argsSchema>>;

function countSection(section: CanvasSection): { words: number; characters: number } {
  const parts: string[] = [];
  for (const bullet of section.bullets) parts.push(bullet);
  for (const paragraph of section.paragraphs) parts.push(paragraph);
  for (const quote of section.quotes) parts.push(quote.text);
  const joined = parts.join(" ");
  const words = joined.trim() ? joined.trim().split(/\s+/).length : 0;
  return { words, characters: joined.length };
}
