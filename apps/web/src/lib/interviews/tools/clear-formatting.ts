import { z } from "zod";
import type { Tool } from "./_types";

const argsSchema = z.object({
  sectionId: z.string().min(1),
  paragraphId: z.string().min(1),
  range: z
    .object({
      from: z.number().int().min(0),
      to: z.number().int().min(0),
    })
    .optional(),
});

type Args = z.infer<typeof argsSchema>;

/**
 * Strips every Phase-3 inline mark (bold, italic, underline, strike,
 * inline code, link, highlight) from either a specified range or the
 * entire paragraph when `range` is omitted. See `_marks.ts` for the
 * markdown-escape representation Phase 3 uses.
 *
 * Implementation: regex-based unwrap. We deliberately scan the text
 * iteratively because nested marks (e.g. bold inside italic) compose
 * as `**_..._**` — one pass per marker.
 */
const MARK_PATTERNS: Array<{ open: RegExp; replace: string }> = [
  // Bold (`**...**`) — handle first so we don't eat the inner italic asterisks.
  { open: /\*\*([^*]+)\*\*/g, replace: "$1" },
  // Italic (`*...*`)
  { open: /\*([^*]+)\*/g, replace: "$1" },
  // Strike (`~~...~~`)
  { open: /~~([^~]+)~~/g, replace: "$1" },
  // Inline code (`` `...` ``)
  { open: /`([^`]+)`/g, replace: "$1" },
  // Link (`[text](url)`)
  { open: /\[([^\]]+)\]\(([^)]+)\)/g, replace: "$1" },
  // Underline (`<u>...</u>`)
  { open: /<u>([\s\S]*?)<\/u>/g, replace: "$1" },
  // Highlight (`<mark ...>...</mark>`)
  { open: /<mark[^>]*>([\s\S]*?)<\/mark>/g, replace: "$1" },
];

function stripMarks(text: string): string {
  let out = text;
  for (const { open, replace } of MARK_PATTERNS) {
    out = out.replace(open, replace);
  }
  return out;
}

/**
 * Removes every Phase-3 mark wrapping inside the target range (or the
 * full paragraph when `range` is omitted). Tracks pre/post-range
 * segments so partial selections only touch the requested slice.
 */
export default {
  name: "clear_formatting",
  description:
    "Remove all marks (bold/italic/etc.) from a paragraph or a specified range.",
  category: "marks",
  argsSchema,
  executionMode: "sync",
  perSessionCap: 200,
  handler: (args, ctx) => {
    const text = ctx.worker.getParagraphText(args.sectionId, args.paragraphId);
    if (text === null) {
      return {
        ok: false,
        category: "not-found",
        message: `Paragraph "${args.paragraphId}" not found in section "${args.sectionId}".`,
      };
    }
    let next: string;
    if (args.range) {
      if (args.range.to < args.range.from) {
        return {
          ok: false,
          category: "validation",
          message: "range.to must be >= range.from.",
        };
      }
      const from = Math.min(Math.max(0, args.range.from), text.length);
      const to = Math.min(Math.max(from, args.range.to), text.length);
      next = `${text.slice(0, from)}${stripMarks(text.slice(from, to))}${text.slice(to)}`;
    } else {
      next = stripMarks(text);
    }
    const ok = ctx.worker.setParagraphText(args.sectionId, args.paragraphId, next);
    if (!ok) {
      return {
        ok: false,
        category: "not-found",
        message: `Paragraph "${args.paragraphId}" not found in section "${args.sectionId}".`,
      };
    }
    return { ok: true, summary: "formatting_cleared" };
  },
} satisfies Tool<Args>;
