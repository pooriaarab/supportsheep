/**
 * HowTo Tiptap nodes.
 *
 * Provides a block-level `howto` container that groups one or more `howtoStep`
 * children inside an ordered list. Each `howtoStep` has a heading-style
 * `howtoStepName` (rendered as an `<h3>` so it shares heading-anchor behaviour
 * with other headings) and a block-level `howtoStepContent` that may contain
 * paragraphs, lists, etc.
 *
 * Rendered HTML matches the structure consumed by the public article renderer
 * and the `HowTo` JSON-LD emitter:
 *
 *   <section class="howto" data-block="howto">
 *     <ol class="howto-steps">
 *       <li class="howto-step">
 *         <h3 class="howto-step-name">Step name</h3>
 *         <div class="howto-step-content">Step blocks</div>
 *       </li>
 *     </ol>
 *   </section>
 *
 * The sanitizer (see article-html.ts) must preserve `section.howto`,
 * `ol.howto-steps`, `li.howto-step`, `h3.howto-step-name`,
 * `div.howto-step-content`, and the `data-block="howto"` attribute so the
 * JSON-LD emitter can still detect HowTo blocks after sanitisation.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    howto: {
      /** Insert a new HowTo block containing one empty step. */
      setHowTo: () => ReturnType;
      /** Append a new empty step to the HowTo block at the current selection. */
      addHowToStep: () => ReturnType;
    };
  }
}

/** HowTo step name — rendered as `<h3 class="howto-step-name">`. */
export const HowToStepName = Node.create({
  name: "howtoStepName",
  content: "inline*",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "h3.howto-step-name" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "h3",
      mergeAttributes(HTMLAttributes, { class: "howto-step-name" }),
      0,
    ];
  },
});

/** HowTo step content — rendered as `<div class="howto-step-content">`, allows block content. */
export const HowToStepContent = Node.create({
  name: "howtoStepContent",
  content: "block+",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "div.howto-step-content" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "howto-step-content" }),
      0,
    ];
  },
});

/** HowTo step — pairs a name and content inside `<li class="howto-step">`. */
export const HowToStep = Node.create({
  name: "howtoStep",
  content: "howtoStepName howtoStepContent",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "li.howto-step" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, { class: "howto-step" }),
      0,
    ];
  },
});

/**
 * Top-level HowTo block — renders as:
 *   <section class="howto" data-block="howto">
 *     <ol class="howto-steps">...</ol>
 *   </section>
 *
 * The outer `<section>` is what the sanitiser and JSON-LD extractor anchor on,
 * while the inner `<ol>` drives numbered rendering in both the editor and the
 * public article.
 */
export const HowTo = Node.create({
  name: "howto",
  group: "block",
  content: "howtoStep+",
  defining: true,

  parseHTML() {
    // The rendered markup nests the step list under an `<ol class="howto-steps">`
    // inside the section. `contentElement` tells the parser where to look for
    // `howtoStep` children so they are not accidentally swallowed by the
    // StarterKit `orderedList` node, and it also lets us round-trip HowTo
    // blocks that were pasted as plain HTML.
    const contentElement = (node: HTMLElement): HTMLElement => {
      const list = node.querySelector?.(
        "ol.howto-steps",
      ) as HTMLElement | null;
      return list ?? node;
    };
    return [
      {
        tag: 'section.howto[data-block="howto"]',
        contentElement,
      },
      {
        tag: "section.howto",
        contentElement,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        class: "howto",
        "data-block": "howto",
      }),
      ["ol", { class: "howto-steps" }, 0],
    ];
  },

  addCommands() {
    return {
      setHowTo:
        () =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({
              type: "howto",
              content: [emptyHowToStep()],
            })
            .run(),

      addHowToStep:
        () =>
        ({ state, chain }) => {
          const howtoRange = findEnclosingHowToRange(state);
          if (!howtoRange) return false;
          return chain()
            .focus()
            .insertContentAt(howtoRange.insertAt, emptyHowToStep())
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => {
        const editor = this.editor as Editor;
        if (!isSelectionInsideHowTo(editor)) return false;
        return editor.commands.addHowToStep();
      },
    };
  },
});

/** JSON description of a blank HowTo step (name + single empty paragraph content). */
function emptyHowToStep() {
  return {
    type: "howtoStep",
    content: [
      { type: "howtoStepName" },
      {
        type: "howtoStepContent",
        content: [{ type: "paragraph" }],
      },
    ],
  };
}

/**
 * Find the document range of the nearest `howto` node that contains the
 * current selection, if any.
 *
 * `start` is the position just before the howto's opening token (useful for
 * selecting the whole node). `insertAt` is the position just before the
 * howto's closing token — the right gap for `insertContentAt` to append a new
 * child INSIDE the howto rather than after it.
 */
export function findEnclosingHowToRange(
  state: Editor["state"],
): { start: number; end: number; insertAt: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "howto") {
      const start = $from.before(depth);
      const end = start + node.nodeSize;
      // `end - 1` is the position just before the howto's closing token, i.e.
      // the last valid gap inside the howto node. Inserting at `end` would
      // place the content OUTSIDE the howto (in the parent doc) where
      // `howtoStep` is not a valid block and the command would silently no-op.
      return { start, end, insertAt: end - 1 };
    }
  }
  return null;
}

function isSelectionInsideHowTo(editor: Editor): boolean {
  return findEnclosingHowToRange(editor.state) !== null;
}
