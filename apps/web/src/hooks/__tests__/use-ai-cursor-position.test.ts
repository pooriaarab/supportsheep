import { describe, expect, it } from "vitest";
import { resolveAiCursorPos } from "../use-ai-cursor-position";
import type { CanvasState } from "@/hooks/use-interview-session";

/**
 * Minimal stand-in for the bits of a real TipTap editor `resolveAiCursorPos`
 * reads from. The real editor exposes a ProseMirror doc whose top-level
 * children each carry a `nodeSize`; the resolver only cares about
 * `content.childCount`, `content.child(i).nodeSize`, and `content.size`,
 * so a tiny stub keeps the test independent of the full TipTap stack.
 */
function makeEditor(nodeSizes: number[], opts?: { lastIsBlock?: boolean }) {
  const size = nodeSizes.reduce((acc, s) => acc + s, 0);
  const lastIsBlock = opts?.lastIsBlock ?? true;
  return {
    state: {
      doc: {
        content: {
          childCount: nodeSizes.length,
          size,
          child(i: number) {
            // The resolver inspects `isBlock` on the last walked child to
            // decide whether to back the cursor into the paragraph's
            // trailing edge. Default every child to a block so the
            // typical paragraph/heading layout behaves as expected.
            const isBlock =
              i === nodeSizes.length - 1 ? lastIsBlock : true;
            return { nodeSize: nodeSizes[i], isBlock };
          },
        },
      },
    },
    // Cast is intentional — `resolveAiCursorPos` only touches `editor.state.doc`,
    // and the typed surface is too broad to mock in full here.
  } as unknown as Parameters<typeof resolveAiCursorPos>[0];
}

const baseCanvas = (overrides: Partial<CanvasState> = {}): CanvasState => ({
  title: null,
  sections: [],
  meta: { description: null, tags: [], suggestedCategory: null },
  ...overrides,
});

describe("resolveAiCursorPos", () => {
  it("returns null when the editor is missing", () => {
    expect(resolveAiCursorPos(null, baseCanvas(), null)).toBeNull();
  });

  it("returns null for an empty editor doc", () => {
    const editor = makeEditor([]);
    expect(resolveAiCursorPos(editor, baseCanvas(), null)).toBeNull();
  });

  it("returns null when no section id is provided (so the caller hides the cursor)", () => {
    const editor = makeEditor([4, 6, 10]);
    expect(resolveAiCursorPos(editor, baseCanvas(), null)).toBeNull();
  });

  it("returns null when the section id isn't in the canvas", () => {
    const editor = makeEditor([4, 6]);
    const canvas = baseCanvas({
      sections: [
        { id: "s1", heading: null, bullets: [], paragraphs: [], quotes: [] },
      ],
    });
    expect(resolveAiCursorPos(editor, canvas, "missing")).toBeNull();
  });

  it("lands INSIDE the last block of the target section", () => {
    // Title (1 node, size 4) + s1 heading (size 6) + s1 paragraph (size 12)
    //                                              + s2 heading (size 8)
    // Raw sum after walking s1 = 4 + 6 + 12 = 22. Subtract 1 to land
    // INSIDE the trailing block (before its closing token) so the
    // cursor doesn't strand at the between-blocks gap below the
    // paragraph — the W24.A typewriter "cursor pinned at bottom" fix.
    const editor = makeEditor([4, 6, 12, 8]);
    const canvas = baseCanvas({
      title: "Title",
      sections: [
        {
          id: "s1",
          heading: "Section One",
          bullets: [],
          paragraphs: ["Hello"],
          quotes: [],
        },
        {
          id: "s2",
          heading: "Section Two",
          bullets: [],
          paragraphs: [],
          quotes: [],
        },
      ],
    });
    expect(resolveAiCursorPos(editor, canvas, "s1")).toBe(21);
  });

  it("clamps to childCount when the canvas is briefly ahead of the editor doc", () => {
    // Editor only has 2 children rendered yet, but the canvas already
    // claims the section spans 5 nodes. Walked sum = 3 + 5 = 8, then
    // minus 1 for "inside last block" = 7.
    const editor = makeEditor([3, 5]);
    const canvas = baseCanvas({
      sections: [
        {
          id: "s1",
          heading: "h",
          bullets: ["a", "b"],
          paragraphs: ["p1", "p2"],
          quotes: [],
        },
      ],
    });
    expect(resolveAiCursorPos(editor, canvas, "s1")).toBe(7);
  });
});
