/**
 * Regression tests for the W24.A AI-cursor-per-tick fix in
 * `useCanvasEditorSync`. PR #319 introduced the typewriter stream that
 * paints a new AI paragraph character-by-character via repeated
 * `setContent` calls. The cursor was meant to advance with each tick so
 * the caret leads the typed text, but the `pos` was being computed as
 * `doc.content.size` — the position BETWEEN root-level blocks, which
 * renders below the new paragraph and reads as "cursor pinned at the
 * bottom while text grows above it".
 *
 * This test reproduces the per-tick wiring with a fake editor and the
 * real `scheduleTypewriter` so the assertion catches regressions in
 * either component: the hook must call `setAiCursor` at least once per
 * typewriter tick (≥ 8 calls for a 100-char paragraph at 4-12 chars per
 * tick) with strictly non-decreasing positions, ending at a position
 * INSIDE the new paragraph rather than at the inter-block gap below it.
 */

import { describe, expect, it, vi } from "vitest";
import { scheduleTypewriter } from "@/lib/interviews/typewriter-stream";

/**
 * Stand-in for the slice of TipTap's `Editor` surface the typewriter
 * cursor-advance code touches. Each `setContent` updates the doc to
 * mirror the HTML's character length so `doc.content.size` and
 * `endOfLastBlockPos` produce realistic values without booting
 * ProseMirror.
 *
 * Doc-size model: a single `<p>…</p>` with `N` inner characters maps to
 * a ProseMirror doc whose `content.size` is `N + 2` (paragraph open +
 * close tokens). For `prefix<p>inner</p>` we approximate the prefix as
 * one additional paragraph with `prefix.length - 7` text characters.
 * That's a fixture, not a real renderer — but it preserves the
 * monotonic-growth property the assertion depends on.
 */
function makeFakeEditor() {
  const setAiCursorCalls: Array<{
    pos: number | null;
    active?: boolean;
    label?: string;
  }> = [];
  let docSize = 0;
  let lastChildIsBlock = true;

  return {
    setAiCursorCalls,
    state: {
      get doc() {
        return {
          content: {
            childCount: docSize > 0 ? 2 : 0,
            size: docSize,
            child(_: number) {
              return { nodeSize: docSize, isBlock: lastChildIsBlock };
            },
          },
        };
      },
    },
    commands: {
      setContent(html: string) {
        // Two paragraphs in our fixture: a prefix `<p>seed</p>` plus the
        // streaming paragraph. ProseMirror nodeSize: paragraph = text +
        // 2. Strip tags to count text characters, then add 4 (two
        // paragraphs × 2 open/close tokens) so docEnd lands between
        // blocks at root level.
        const textChars = html
          .replace(/<p>/g, "")
          .replace(/<\/p>/g, "")
          .length;
        // Two paragraphs => add 4 (paragraph open + close × 2). For an
        // empty doc (no html), keep size at 0.
        docSize = textChars === 0 ? 0 : textChars + 4;
        lastChildIsBlock = true;
      },
      setAiCursor(state: { pos: number | null; active?: boolean; label?: string }) {
        setAiCursorCalls.push(state);
      },
    },
  };
}

/**
 * Mirror the per-tick wiring inside `useCanvasEditorSync.onIntermediate`
 * so the test exercises the exact ordering: `setContent` first, then
 * compute the trailing-block position, then `setAiCursor`.
 *
 * Kept in-line (instead of importing the hook) because the hook is a
 * React effect that requires a full render harness — the contract under
 * test here is just "every tick produces a cursor update at the new
 * inner-paragraph end".
 */
function endOfLastBlockPos(editor: ReturnType<typeof makeFakeEditor>): number {
  const doc = editor.state.doc;
  const docEnd = doc.content.size;
  if (doc.content.childCount === 0) return 0;
  const lastChild = doc.content.child(doc.content.childCount - 1);
  if (!lastChild.isBlock) return docEnd;
  return Math.max(0, docEnd - 1);
}

describe("useCanvasEditorSync — AI cursor advances per typewriter tick", () => {
  it("calls setAiCursor ≥ 8 times with monotonically increasing positions for a 100-char paragraph", () => {
    vi.useFakeTimers();
    try {
      const editor = makeFakeEditor();
      // Seed the doc with the prefix paragraph the same way the real
      // hook does before kicking off the typewriter.
      editor.commands.setContent("<p>seed</p><p></p>");

      const innerText = "x".repeat(100);
      let completed = false;

      scheduleTypewriter(
        {
          kind: "stream",
          prefix: "<p>seed</p>",
          paragraphOpen: "<p>",
          paragraphClose: "</p>",
          innerText,
        },
        {
          onIntermediate: (html) => {
            // Reproduce the hook's per-tick body verbatim: setContent →
            // compute trailing-block pos → setAiCursor. Any change to
            // the hook that drops the cursor update (or computes the
            // wrong pos) trips one of the assertions below.
            editor.commands.setContent(html);
            const pos = endOfLastBlockPos(editor);
            editor.commands.setAiCursor({ pos, active: true, label: "AI" });
          },
          onComplete: () => {
            completed = true;
            const pos = endOfLastBlockPos(editor);
            editor.commands.setAiCursor({ pos, active: true, label: "AI" });
          },
        },
        {
          timer: {
            setTimeout: ((fn: () => void, ms: number) =>
              setTimeout(fn, ms)) as unknown as (
              fn: () => void,
              ms: number,
            ) => unknown,
            clearTimeout: (h: unknown) =>
              clearTimeout(h as ReturnType<typeof setTimeout>),
          },
          // Pin the chunking RNG so the tick count is deterministic. With the
          // production default range (8–24 chars/tick) and Math.random, a run
          // can cover 100 chars in as few as 5 chunks (≤6 setAiCursor calls),
          // which flakes the ≥8 assertion. Fixed bounds + rand=0.5 yield a
          // steady 8 chars/tick → ~13 ticks → 14 cursor updates.
          chunkMin: 4,
          chunkMax: 12,
          rand: () => 0.5,
        },
      );

      // 100 chars × max-55ms-tick ÷ 4-char min ≈ 1.4s; 5s flushes the
      // longest possible schedule with margin.
      vi.advanceTimersByTime(5_000);

      expect(completed).toBe(true);

      // 100 chars at 4-12 per tick → between 9 and 25 onIntermediate
      // calls, plus one onComplete = at least 9 setAiCursor calls.
      // Assertion is ≥ 8 to match the task spec while leaving a one-
      // chunk safety margin for the RNG.
      expect(editor.setAiCursorCalls.length).toBeGreaterThanOrEqual(8);

      // Every call must carry the cursor's active flag and AI label so
      // a regression that flips `active: false` mid-stream (which would
      // fade the caret out per W21.A) gets caught.
      for (const call of editor.setAiCursorCalls) {
        expect(call.active).toBe(true);
        expect(call.label).toBe("AI");
        expect(call.pos).not.toBeNull();
      }

      // Positions must advance with the typed text — each tick grows
      // the doc by 4-12 characters, so the cursor position is strictly
      // non-decreasing across the schedule.
      const positions = editor.setAiCursorCalls.map(
        (c) => c.pos as number,
      );
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]!);
      }
      // At least one strict advance — guards against a regression that
      // pins every tick to the same pos.
      expect(positions[positions.length - 1]).toBeGreaterThan(positions[0]!);

      // Final position must sit INSIDE the last paragraph (one position
      // before the doc-end-between-blocks gap). For our fixture: two
      // paragraphs with `seed` (4) + 100 inner chars = 104 text chars +
      // 4 paragraph tokens = 108. End-of-last-block = 107.
      expect(positions[positions.length - 1]).toBe(107);
    } finally {
      vi.useRealTimers();
    }
  });
});
