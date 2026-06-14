import { z } from "zod";
import type { ToolContext, ToolResult } from "./_types";

/**
 * Phase 3 marks store inline formatting as **markdown-style escapes**
 * embedded in the existing `paragraphs: string[]` shape on
 * `CanvasSection`. This is a deliberate trade-off (documented in the
 * PR body): moving to ProseMirror JSON or a richer delta-like format
 * would be a larger data-model migration touching the writer worker,
 * the SSE diff payloads, the React canvas renderer, and the
 * `save-draft.ts` HTML stitcher all at once. The escape approach lets
 * Phase 3 land in a single PR while still round-tripping every mark
 * through the canvas, and the follow-up PR proposed in the design doc
 * (Phase 7 cleanup) can swap the representation without changing the
 * tool surface — the OpenAI tool args stay `{ paragraphId, range }`.
 *
 * Escape conventions (chosen to match TipTap's default markdown
 * shortcuts so the writer worker's prose round-trips cleanly):
 *
 * - bold       → `**...**`
 * - italic     → `*...*`
 * - underline  → `<u>...</u>`            (markdown has no native underline)
 * - strike     → `~~...~~`
 * - code       → `` `...` ``
 * - link       → `[text](url)`           (target="_blank" omitted v1)
 * - highlight  → `<mark data-color="…">…</mark>` (color attr optional)
 */

/** Shared shape for the eight mark tools' args. */
export const markRangeSchema = z.object({
  sectionId: z.string().min(1),
  paragraphId: z.string().min(1),
  range: z.object({
    from: z.number().int().min(0),
    to: z.number().int().min(0),
  }),
});

export type MarkRangeArgs = z.infer<typeof markRangeSchema>;

/**
 * Resolve a paragraph + range and apply a wrapper to the selected
 * substring. Returns the structured `ToolResult` directly so each
 * mark tool stays a one-liner. `wrap` receives the selected text and
 * returns the replacement (typically `prefix + sel + suffix`).
 */
export function applyMarkRange(
  args: MarkRangeArgs,
  ctx: ToolContext,
  wrap: (selected: string) => string,
  summary: string,
): ToolResult {
  const { sectionId, paragraphId, range } = args;
  if (range.to < range.from) {
    return {
      ok: false,
      category: "validation",
      message: "range.to must be >= range.from.",
    };
  }
  const text = ctx.worker.getParagraphText(sectionId, paragraphId);
  if (text === null) {
    return {
      ok: false,
      category: "not-found",
      message: `Paragraph "${paragraphId}" not found in section "${sectionId}".`,
    };
  }
  const from = Math.min(Math.max(0, range.from), text.length);
  const to = Math.min(Math.max(from, range.to), text.length);
  const before = text.slice(0, from);
  const sel = text.slice(from, to);
  const after = text.slice(to);
  const next = `${before}${wrap(sel)}${after}`;
  const ok = ctx.worker.setParagraphText(sectionId, paragraphId, next);
  if (!ok) {
    return {
      ok: false,
      category: "not-found",
      message: `Paragraph "${paragraphId}" not found in section "${sectionId}".`,
    };
  }
  return { ok: true, summary };
}
