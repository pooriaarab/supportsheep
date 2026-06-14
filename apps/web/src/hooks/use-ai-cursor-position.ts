import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import type { CanvasSection, CanvasState } from "@/hooks/use-interview-session";

/**
 * Compute how many top-level ProseMirror nodes a given canvas section
 * contributes to the serialised TipTap document. Mirrors the layout
 * decisions in `canvas-to-tiptap.ts`:
 *
 *   - One heading node when `section.heading` is non-empty.
 *   - One bulletList node when at least one bullet exists.
 *   - One paragraph node per `paragraphs` entry.
 *   - One blockquote node per `quotes` entry.
 *   - One block node per entry in the freeform `blocks` array.
 *
 * Kept narrow and pure so the AI-cursor position lookup can map a
 * `lastWriteSectionId` to a node index without re-implementing the
 * full converter.
 */
function countSectionNodes(section: CanvasSection): number {
  let n = 0;
  if (section.heading) n += 1;
  if (section.bullets.length > 0) n += 1;
  n += section.paragraphs.length;
  n += section.quotes.length;
  if (section.blocks) n += section.blocks.length;
  return n;
}

/**
 * Resolve the ProseMirror position that sits at the END of the canvas
 * section identified by `lastWriteSectionId`.
 *
 * Returns `null` when the editor doc is empty, when no section id is
 * provided, or when the section isn't found — in which case the caller
 * should hide the AI cursor decoration entirely. Pinning the cursor to
 * end-of-doc during idle / unknown states is what produced the "bar
 * stuck at the right edge" artefact when the last block filled its
 * line to the prose container's max-width; we'd rather show nothing
 * than mis-anchor the caret to a spot the AI didn't actually write at.
 *
 * Algorithm:
 *   1. Build a running node-count up to and including the target
 *      section, accounting for the optional title heading node and
 *      every prior section's contribution.
 *   2. Walk the editor's top-level children, accumulating each child's
 *      `nodeSize`, until we've consumed `targetNodeIndex` children.
 *      The accumulated size is the position AFTER that nth child —
 *      which is exactly where a teammate's caret would sit at the end
 *      of the section the AI just touched.
 *
 * Exported separately from the React hook so unit tests can pin the
 * arithmetic without booting TipTap.
 */
export function resolveAiCursorPos(
  editor: Editor | null,
  canvas: CanvasState,
  lastWriteSectionId: string | null,
): number | null {
  if (!editor) return null;
  const doc = editor.state.doc;
  if (doc.content.childCount === 0) return null;

  const docEnd = doc.content.size;

  // Without a recent-write section id we have no idea where the AI's
  // caret should live. Hide it instead of pinning to end-of-doc, which
  // visually reads as a stray bar at the bottom-right of the canvas.
  if (!lastWriteSectionId) return null;

  const idx = canvas.sections.findIndex((s) => s.id === lastWriteSectionId);
  if (idx === -1) return null;

  // How many top-level nodes precede + include this section's last block?
  const titleNodes = canvas.title ? 1 : 0;
  let nodesUpToAndIncludingSection = titleNodes;
  for (let i = 0; i <= idx; i++) {
    nodesUpToAndIncludingSection += countSectionNodes(canvas.sections[i]!);
  }

  if (nodesUpToAndIncludingSection === 0) return docEnd;

  // Walk the doc's top-level children to accumulate their nodeSize. The
  // child count in the live editor may be smaller than the canvas's
  // node count by one render cycle — clamp to whichever is shorter so
  // the cursor never overshoots.
  const targetChildren = Math.min(
    nodesUpToAndIncludingSection,
    doc.content.childCount,
  );

  let pos = 0;
  for (let i = 0; i < targetChildren; i++) {
    pos += doc.content.child(i).nodeSize;
  }

  // Land INSIDE the last walked block (one position before its closing
  // token) instead of BETWEEN this block and the next. The unadjusted
  // position renders the cursor below the section's last paragraph,
  // which reads as a caret pinned at the bottom while the section's
  // text grows above it — the artefact W24.A is fixing for the
  // typewriter stream. Only adjust when the last walked child is a
  // block node; for inline content or an empty walk, fall through to
  // the raw position.
  if (targetChildren > 0) {
    const lastWalked = doc.content.child(targetChildren - 1);
    if (lastWalked.isBlock && pos > 0) {
      pos -= 1;
    }
  }

  // Clamp into the open document range so a transient mismatch
  // between the canvas snapshot and the editor doc can never produce
  // an out-of-range position for the decoration.
  if (pos < 0) return 0;
  if (pos > docEnd) return docEnd;
  return pos;
}

interface UseAiCursorPositionArgs {
  editor: Editor | null;
  canvas: CanvasState;
  active: boolean;
  lastWriteSectionId: string | null;
}

/**
 * Keep the `AiCursor` ProseMirror plugin's decoration aligned with the
 * AI writer-worker's current edit position. Reacts to:
 *
 *   - `active` changes (writer-worker turning on/off) — toggles the
 *     decoration's `active` flag so the cursor fades in/out via the
 *     existing CSS opacity transition (matches the 1500ms idle debounce
 *     upstream).
 *   - `lastWriteSectionId` changes — recomputes the natural caret
 *     position so the cursor jumps to the section the writer just
 *     touched, instead of staying pinned at end-of-doc.
 *   - `canvas` changes — re-resolves the position because the section's
 *     node count may have grown (new paragraph, bullet, etc.).
 *
 * Direct `useEffect` is banned project-wide via ESLint; this is the
 * sanctioned wrapper hook for the position-sync side-effect (same
 * pattern as `useCanvasEditorSync`).
 */
export function useAiCursorPosition({
  editor,
  canvas,
  active,
  lastWriteSectionId,
}: UseAiCursorPositionArgs): void {
  // eslint-disable-next-line no-restricted-syntax -- dedicated sync wrapper hook
  useEffect(() => {
    if (!editor) return;
    // When the writer is idle, hide the cursor entirely (pos: null) so it
    // doesn't linger pinned at end-of-doc — which the user sees as a
    // bar stuck against the right edge of the canvas container.
    const pos = active
      ? resolveAiCursorPos(editor, canvas, lastWriteSectionId)
      : null;
    editor.commands.setAiCursor({
      pos,
      active,
      label: "AI",
    });
  }, [editor, canvas, active, lastWriteSectionId]);
}
