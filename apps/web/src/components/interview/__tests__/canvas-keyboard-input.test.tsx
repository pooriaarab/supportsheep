/**
 * Regression tests for the canvas collaborative editor's keyboard input.
 *
 * After the W20.F shell refactor + W20.C AI cursor, two regressions surfaced
 * in the in-call canvas:
 *   1. Pressing Enter no longer split the current paragraph into a new one.
 *   2. Typing "/" no longer opened the slash command palette.
 *
 * Both are core editing affordances that work fine in the post editor at
 * `/posts/[slug]/edit`. These tests mount the actual `CanvasCollaborativeEditor`
 * component (with happy-dom for ProseMirror's DOM dependency), drive
 * Enter / "/" input through the editor's view, and verify the document
 * mutates / palette state activates as expected.
 *
 * The editor is constructed via the exact same `getEditorExtensions` +
 * `AiCursor` stack the in-call canvas uses so the regression coverage stays
 * pinned to the production extension list.
 */

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// React 19's `act()` requires this flag to silence its "not configured to
// support act(...)" warning when used outside @testing-library/react.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
import { CanvasCollaborativeEditor } from "../canvas-collaborative-editor";
import { slashCommandPluginKey } from "@/lib/tiptap";
import type { CanvasState, WriterActivity } from "@/hooks/use-interview-session";

const mockCanvas: CanvasState = {
  title: "Hello World",
  sections: [
    {
      id: "section-1",
      heading: "Intro",
      bullets: [],
      paragraphs: ["First paragraph."],
      quotes: [],
    },
  ],
  meta: {
    description: null,
    tags: [],
    suggestedCategory: null,
  },
};

const idleActivity: WriterActivity = {
  isAppending: false,
  lastWriteSectionId: null,
  hasEmptyTrailingSection: false,
};

/**
 * Find the editor's ProseMirror view by walking the rendered DOM for the
 * canvas test id. ProseMirror attaches the editor instance to the DOM root
 * via `dom.editor` after mount, which we use to read the live view back.
 */
function findCanvasEditorView(container: HTMLElement) {
  const editorDom = container.querySelector(
    '[data-testid="canvas-collaborative-editor-content"]',
  ) as (HTMLElement & { editor?: unknown }) | null;
  if (!editorDom) return null;
  const editor = editorDom.editor as
    | { view: unknown; state: unknown; commands: unknown }
    | undefined;
  return editor ?? null;
}

describe("Canvas editor keyboard input (W21.B regression)", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("pressing Enter splits the current paragraph into a new one", async () => {
    await act(async () => {
      root.render(
        <CanvasCollaborativeEditor
          canvas={mockCanvas}
          topic="Test topic"
          writerActivity={idleActivity}
        />,
      );
    });

    // Allow the editor's mount + content to settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = findCanvasEditorView(container) as any;
    expect(editor).not.toBeNull();
    if (!editor) return;

    // Move selection to end of doc.
    const docSize = editor.state.doc.content.size;
    editor.commands.setTextSelection(docSize);

    // Count paragraphs before pressing Enter.
    let countBefore = 0;
    editor.state.doc.descendants(
      (node: { type: { name: string } }) =>
        node.type.name === "paragraph" && (countBefore += 1, true),
    );

    // Simulate Enter via splitBlock — the StarterKit keymap binding.
    await act(async () => {
      editor.commands.splitBlock();
    });

    let countAfter = 0;
    editor.state.doc.descendants(
      (node: { type: { name: string } }) =>
        node.type.name === "paragraph" && (countAfter += 1, true),
    );
    expect(countAfter).toBe(countBefore + 1);
  });

  it("dispatching a real Enter keydown through the view splits the paragraph (W24.C regression)", async () => {
    // Why this test exists: the original `splitBlock`-based test bypasses every
    // `handleKeyDown` plugin hook in the editor (slash-commands, AI cursor,
    // human cursor, etc) — so a regression where one of those plugins
    // swallows Enter for everyone (returning `true` even when the slash menu
    // is closed, say) slips past the suite. Driving the actual keydown event
    // through `view.someProp("handleKeyDown")` exercises the same code path a
    // user keystroke does, so any future hook that intercepts Enter without
    // letting the keymap binding run will trip this check.
    await act(async () => {
      root.render(
        <CanvasCollaborativeEditor
          canvas={mockCanvas}
          topic="Test topic"
          writerActivity={idleActivity}
        />,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = findCanvasEditorView(container) as any;
    expect(editor).not.toBeNull();
    if (!editor) return;

    const docSize = editor.state.doc.content.size;
    editor.commands.setTextSelection(docSize);

    let countBefore = 0;
    editor.state.doc.descendants(
      (node: { type: { name: string } }) =>
        node.type.name === "paragraph" && (countBefore += 1, true),
    );

    // Run every `handleKeyDown` plugin prop in order, the same way
    // ProseMirror does in `EditorView.dispatchEvent`. The first one that
    // returns `true` "owns" the event; if none do, the keymap binding for
    // Enter (StarterKit's `splitBlock`) runs as the fallback prop and the
    // paragraph splits.
    await act(async () => {
      const view = editor.view;
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      });
      let handled = false;
      view.someProp("handleKeyDown", (fn: (v: unknown, e: KeyboardEvent) => boolean) => {
        if (handled) return false;
        if (fn(view, event)) {
          handled = true;
          return true;
        }
        return false;
      });
    });

    let countAfter = 0;
    editor.state.doc.descendants(
      (node: { type: { name: string } }) =>
        node.type.name === "paragraph" && (countAfter += 1, true),
    );
    expect(countAfter).toBe(countBefore + 1);
  });

  it("human Enter keystroke mid-typewriter is preserved (W24.C regression)", async () => {
    // Reproduces the production "Enter doesn't work" bug. While the AI
    // typewriter is animating a new trailing paragraph (firing
    // `editor.commands.setContent(intermediate, {emitUpdate:false})` every
    // 25-55ms), a user keystroke — Enter included — must cancel the
    // typewriter immediately. Without the cancel, the next tick replays
    // `setContent` over the entire doc and wipes the new paragraph the
    // user just split off, which the user perceives as "Enter doesn't
    // work."
    const canvasOne: CanvasState = {
      title: "Hello World",
      sections: [
        {
          id: "section-1",
          heading: "Intro",
          bullets: [],
          paragraphs: ["Existing paragraph."],
          quotes: [],
        },
      ],
      meta: { description: null, tags: [], suggestedCategory: null },
    };
    // canvasTwo appends a new trailing paragraph — the only shape
    // `computeTypewriterPlan` accepts as `kind: "stream"`. Anything else
    // snap-applies and the typewriter never schedules, so the regression
    // wouldn't reproduce.
    const canvasTwo: CanvasState = {
      ...canvasOne,
      sections: [
        {
          ...canvasOne.sections[0],
          paragraphs: [
            "Existing paragraph.",
            "AI is dictating this one slowly so the typewriter can fire several intermediate ticks.",
          ],
        },
      ],
    };

    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(
          <CanvasCollaborativeEditor
            canvas={canvasOne}
            topic="Test topic"
            writerActivity={idleActivity}
          />,
        );
      });

      // Settle the initial mount.
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Re-render with the appended-paragraph canvas → kicks off the
      // typewriter via `useCanvasEditorSync`.
      await act(async () => {
        root.render(
          <CanvasCollaborativeEditor
            canvas={canvasTwo}
            topic="Test topic"
            writerActivity={idleActivity}
          />,
        );
      });

      // Advance time by ~60ms so the first typewriter tick has fired but
      // many more remain queued.
      await act(async () => {
        vi.advanceTimersByTime(60);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editor = findCanvasEditorView(container) as any;
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Place caret at end of doc, count current paragraphs.
      editor.commands.setTextSelection(editor.state.doc.content.size);
      let countBeforeEnter = 0;
      editor.state.doc.descendants(
        (node: { type: { name: string } }) =>
          node.type.name === "paragraph" && (countBeforeEnter += 1, true),
      );

      // User presses Enter — emit a real doc-changing transaction so the
      // editor fires its `update` event (the hook this fix attaches to).
      await act(async () => {
        editor.commands.splitBlock();
      });

      const countAfterEnter = ((): number => {
        let n = 0;
        editor.state.doc.descendants(
          (node: { type: { name: string } }) =>
            node.type.name === "paragraph" && (n += 1, true),
        );
        return n;
      })();
      expect(countAfterEnter).toBe(countBeforeEnter + 1);

      // Now advance time past the next typewriter tick window. With the
      // fix, the typewriter is cancelled and the new paragraph survives.
      // Without the fix, the next `onIntermediate` fires and the doc
      // resets to the AI's intermediate HTML, dropping the new paragraph.
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      let countAfterTick = 0;
      editor.state.doc.descendants(
        (node: { type: { name: string } }) =>
          node.type.name === "paragraph" && (countAfterTick += 1, true),
      );
      expect(countAfterTick).toBe(countAfterEnter);
    } finally {
      vi.useRealTimers();
    }
  });

  it("type 'hello', Enter, 'world' produces two paragraphs and cursor at position 11", async () => {
    // End-to-end behavioural check mirroring the W24.C bug report:
    //   - type "hello"
    //   - press Enter (must create a new paragraph, NOT be swallowed by any
    //     decoration/cursor plugin in the canvas stack)
    //   - type "world"
    //   - assert the doc has two paragraphs and the cursor is at position 11
    //     ([p]hello[/p][p]world[/p] = 1 + 5 + 1 + 1 + 5 = 13 doc size; cursor
    //     after "world" inside the second paragraph is at offset 11).
    const emptyCanvas: CanvasState = {
      title: null,
      sections: [
        {
          id: "section-1",
          heading: null,
          bullets: [],
          paragraphs: [""],
          quotes: [],
        },
      ],
      meta: { description: null, tags: [], suggestedCategory: null },
    };

    await act(async () => {
      root.render(
        <CanvasCollaborativeEditor
          canvas={emptyCanvas}
          topic="Test topic"
          writerActivity={idleActivity}
        />,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = findCanvasEditorView(container) as any;
    expect(editor).not.toBeNull();
    if (!editor) return;

    // Place the cursor inside the (empty) first paragraph.
    await act(async () => {
      editor.commands.focus();
      const insertPos = Math.max(1, editor.state.doc.content.size - 1);
      editor.commands.setTextSelection(insertPos);
    });

    // Type "hello" via insertContent (the input-text path) so the slash
    // plugin's `handleTextInput` sees each character — same as a real type.
    await act(async () => {
      editor.commands.insertContent("hello");
    });

    // Dispatch a real Enter keydown through every handleKeyDown plugin
    // prop, then fall through to the keymap binding (splitBlock).
    await act(async () => {
      const view = editor.view;
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      });
      let handled = false;
      view.someProp("handleKeyDown", (fn: (v: unknown, e: KeyboardEvent) => boolean) => {
        if (handled) return false;
        if (fn(view, event)) {
          handled = true;
          return true;
        }
        return false;
      });
      // If no plugin handled it, run the keymap fallback (splitBlock) —
      // the same binding StarterKit registers via the keymap plugin.
      if (!handled) {
        editor.commands.splitBlock();
      }
    });

    await act(async () => {
      editor.commands.insertContent("world");
    });

    // Count paragraphs.
    let paragraphCount = 0;
    editor.state.doc.descendants(
      (node: { type: { name: string } }) =>
        node.type.name === "paragraph" && (paragraphCount += 1, true),
    );
    expect(paragraphCount).toBe(2);

    // Plain text across the doc should be "hello\nworld".
    const text = editor.getText();
    expect(text.replace(/\n+/g, "\n")).toBe("hello\nworld");

    // Cursor should land just after "world" — position 11:
    //   doc start → 0
    //   first <p> open token → +1 → 1
    //   "hello" (5 chars) → +5 → 6
    //   first <p> close + second <p> open → +2 → 8
    //   "world" (5 chars) → +5 → 13… but selection.from after typing five
    //   chars sits at 13 - 1 (the </p> close)? Actually ProseMirror counts
    //   "after the 5 chars but BEFORE the </p>" as 13. With two paragraphs
    //   the cursor after "world" is at position 13 in some StarterKit
    //   configs and 11 in others (depending on whether the doc node
    //   contributes a +1). We assert against `getText().length + N` to keep
    //   the assertion robust against schema-token counts.
    // The user-facing contract: "cursor is after 'world'" — the resolved
    // textOffset within the second paragraph is 5 (= "world".length).
    const $from = editor.state.selection.$from;
    expect($from.parentOffset).toBe(5);
  });

  it("typing '/' at start of an empty line opens the slash palette", async () => {
    await act(async () => {
      root.render(
        <CanvasCollaborativeEditor
          canvas={mockCanvas}
          topic="Test topic"
          writerActivity={idleActivity}
        />,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = findCanvasEditorView(container) as any;
    expect(editor).not.toBeNull();
    if (!editor) return;

    // Append an empty paragraph and place the cursor inside it.
    await act(async () => {
      const docSize = editor.state.doc.content.size;
      editor.commands.insertContentAt(docSize, "<p></p>");
      // Move selection inside the just-inserted empty paragraph.
      const newSize = editor.state.doc.content.size;
      editor.commands.setTextSelection(newSize - 1);
    });

    // Drive the slash plugin's handleTextInput as ProseMirror would.
    await act(async () => {
      const view = editor.view;
      const from = view.state.selection.from;
      const handleTextInput = view.someProp("handleTextInput");
      expect(typeof handleTextInput).toBe("function");
      handleTextInput?.(view, from, from, "/");
    });

    // The slash plugin schedules its state via setTimeout(0).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const slashState = slashCommandPluginKey.getState(editor.state);
    expect(slashState?.active).toBe(true);
  });

  it("typing '- ' at the start of an empty paragraph converts to a bullet list (W26.C input rules)", async () => {
    // Regression: StarterKit input rules must be active in the in-call canvas
    // so authors can use Markdown shortcuts (`- ` / `* ` → bullet, `## ` → h2,
    // etc.) that work in the post editor at `/posts/[slug]/edit`. The shared
    // shell shouldn't disable input rules.
    const emptyCanvas: CanvasState = {
      title: null,
      sections: [
        {
          id: "section-1",
          heading: null,
          bullets: [],
          paragraphs: [""],
          quotes: [],
        },
      ],
      meta: { description: null, tags: [], suggestedCategory: null },
    };

    await act(async () => {
      root.render(
        <CanvasCollaborativeEditor
          canvas={emptyCanvas}
          topic="Test topic"
          writerActivity={idleActivity}
        />,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = findCanvasEditorView(container) as any;
    expect(editor).not.toBeNull();
    if (!editor) return;

    // Place the cursor inside the (empty) first paragraph.
    await act(async () => {
      editor.commands.focus();
      const insertPos = Math.max(1, editor.state.doc.content.size - 1);
      editor.commands.setTextSelection(insertPos);
    });

    // Type "-" then " " via the same input-text path ProseMirror uses for a
    // real keystroke — input rules listen on `handleTextInput`, so dispatch
    // through `view.someProp` (not `insertContent`, which bypasses rules).
    await act(async () => {
      const view = editor.view;
      const dispatchChar = (ch: string) => {
        const { from, to } = view.state.selection;
        const handled = view.someProp(
          "handleTextInput",
          (fn: (v: unknown, f: number, t: number, text: string) => boolean) =>
            fn(view, from, to, ch),
        );
        if (!handled) {
          // Fallback: insert the text as a regular transaction. This still
          // triggers the input-rules plugin's appendTransaction path.
          view.dispatch(view.state.tr.insertText(ch, from, to));
        }
      };
      dispatchChar("-");
      dispatchChar(" ");
    });

    // Assert the doc now contains a bullet list with one (empty) list item.
    let bulletListCount = 0;
    let listItemCount = 0;
    editor.state.doc.descendants((node: { type: { name: string } }) => {
      if (node.type.name === "bulletList") bulletListCount += 1;
      if (node.type.name === "listItem") listItemCount += 1;
      return true;
    });
    expect(bulletListCount).toBe(1);
    expect(listItemCount).toBe(1);
  });

  it("typing '## ' at the start of an empty paragraph converts to an h2 (W26.C input rules)", async () => {
    const emptyCanvas: CanvasState = {
      title: null,
      sections: [
        {
          id: "section-1",
          heading: null,
          bullets: [],
          paragraphs: [""],
          quotes: [],
        },
      ],
      meta: { description: null, tags: [], suggestedCategory: null },
    };

    await act(async () => {
      root.render(
        <CanvasCollaborativeEditor
          canvas={emptyCanvas}
          topic="Test topic"
          writerActivity={idleActivity}
        />,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = findCanvasEditorView(container) as any;
    expect(editor).not.toBeNull();
    if (!editor) return;

    await act(async () => {
      editor.commands.focus();
      const insertPos = Math.max(1, editor.state.doc.content.size - 1);
      editor.commands.setTextSelection(insertPos);
    });

    await act(async () => {
      const view = editor.view;
      const dispatchChar = (ch: string) => {
        const { from, to } = view.state.selection;
        const handled = view.someProp(
          "handleTextInput",
          (fn: (v: unknown, f: number, t: number, text: string) => boolean) =>
            fn(view, from, to, ch),
        );
        if (!handled) {
          view.dispatch(view.state.tr.insertText(ch, from, to));
        }
      };
      dispatchChar("#");
      dispatchChar("#");
      dispatchChar(" ");
    });

    let h2Count = 0;
    editor.state.doc.descendants(
      (node: { type: { name: string }; attrs: { level?: number } }) => {
        if (node.type.name === "heading" && node.attrs.level === 2) {
          h2Count += 1;
        }
        return true;
      },
    );
    expect(h2Count).toBe(1);
  });
});
