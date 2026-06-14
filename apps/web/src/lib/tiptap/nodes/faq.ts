/**
 * FAQ Tiptap nodes.
 *
 * Provides a block-level `faq` container that groups one or more `faqItem`
 * children. Each `faqItem` has a heading-style `faqQuestion` (rendered as an
 * `<h3>` so it shares heading-anchor behaviour with other headings) and a
 * block-level `faqAnswer` that may contain paragraphs, lists, etc.
 *
 * Rendered HTML matches the structure consumed by the public article renderer
 * and the `FAQPage` JSON-LD emitter:
 *
 *   <section class="faq" data-block="faq">
 *     <div class="faq-item">
 *       <h3 class="faq-question">Question text</h3>
 *       <div class="faq-answer">Answer blocks</div>
 *     </div>
 *   </section>
 *
 * The sanitizer (see PR-8) must preserve `section.faq`, `div.faq-item`,
 * `h3.faq-question`, `div.faq-answer`, and the `data-block="faq"` attribute so
 * the JSON-LD emitter can still detect FAQ blocks after sanitisation.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    faq: {
      /** Insert a new FAQ block containing one empty question/answer pair. */
      insertFaq: () => ReturnType;
      /** Append a new empty question/answer pair to the FAQ block at the current selection. */
      addFaqItem: () => ReturnType;
    };
  }
}

/** FAQ question — rendered as `<h3 class="faq-question">`. */
export const FaqQuestion = Node.create({
  name: "faqQuestion",
  content: "inline*",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "h3.faq-question" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "h3",
      mergeAttributes(HTMLAttributes, { class: "faq-question" }),
      0,
    ];
  },
});

/** FAQ answer — rendered as `<div class="faq-answer">`, allows block content. */
export const FaqAnswer = Node.create({
  name: "faqAnswer",
  content: "block+",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "div.faq-answer" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "faq-answer" }),
      0,
    ];
  },
});

/** FAQ item — pairs a question and answer inside `<div class="faq-item">`. */
export const FaqItem = Node.create({
  name: "faqItem",
  content: "faqQuestion faqAnswer",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "div.faq-item" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "faq-item" }), 0];
  },
});

/** Top-level FAQ block — renders as `<section class="faq" data-block="faq">`. */
export const Faq = Node.create({
  name: "faq",
  group: "block",
  content: "faqItem+",
  defining: true,

  parseHTML() {
    return [{ tag: 'section.faq[data-block="faq"]' }, { tag: "section.faq" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        class: "faq",
        "data-block": "faq",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertFaq:
        () =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({
              type: "faq",
              content: [emptyFaqItem()],
            })
            .run(),

      addFaqItem:
        () =>
        ({ state, chain }) => {
          const faqRange = findEnclosingFaqRange(state);
          if (!faqRange) return false;
          return chain()
            .focus()
            .insertContentAt(faqRange.insertAt, emptyFaqItem())
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => {
        const editor = this.editor as Editor;
        if (!isSelectionInsideFaq(editor)) return false;
        return editor.commands.addFaqItem();
      },
    };
  },
});

/** JSON description of a blank FAQ item (question + single empty paragraph answer). */
function emptyFaqItem() {
  return {
    type: "faqItem",
    content: [
      { type: "faqQuestion" },
      {
        type: "faqAnswer",
        content: [{ type: "paragraph" }],
      },
    ],
  };
}

/**
 * Find the document range of the nearest `faq` node that contains the current
 * selection, if any.
 *
 * `start` is the position just before the faq's opening token (useful for
 * selecting the whole node). `insertAt` is the position just before the faq's
 * closing token — the right gap for `insertContentAt` to append a new child
 * INSIDE the faq rather than after it.
 */
export function findEnclosingFaqRange(
  state: Editor["state"],
): { start: number; end: number; insertAt: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "faq") {
      const start = $from.before(depth);
      const end = start + node.nodeSize;
      // `end - 1` is the position just before the faq's closing token, i.e.
      // the last valid gap inside the faq node. Inserting at `end` would place
      // the content OUTSIDE the faq (in the parent doc) where `faqItem` is not
      // a valid block and the command would silently no-op.
      return { start, end, insertAt: end - 1 };
    }
  }
  return null;
}

function isSelectionInsideFaq(editor: Editor): boolean {
  return findEnclosingFaqRange(editor.state) !== null;
}
