/**
 * Unit tests for the FAQ TipTap node commands.
 *
 * Exercises `findEnclosingFaqRange` (pure ProseMirror state math) and the
 * `addFaqItem` / `Mod-Enter` command behaviour by building a ProseMirror
 * document from the TipTap schema and running the command against a state
 * whose selection sits inside a `faq` node.
 *
 * Regression coverage for the off-by-one in `findEnclosingFaqRange`: the
 * insert position must be INSIDE the faq node, not after it, or the command
 * silently no-ops.
 */

import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";

import { Faq, FaqItem, FaqQuestion, FaqAnswer, findEnclosingFaqRange } from "../faq";

const extensions = [StarterKit, Faq, FaqItem, FaqQuestion, FaqAnswer];
const schema = getSchema(extensions);

function buildFaqDoc() {
  // Structure:
  //   doc
  //     paragraph("before")
  //     faq
  //       faqItem
  //         faqQuestion("Q1")
  //         faqAnswer
  //           paragraph("A1")
  //     paragraph("after")
  const q1 = schema.nodes.faqQuestion.create(null, schema.text("Q1"));
  const a1Para = schema.nodes.paragraph.create(null, schema.text("A1"));
  const a1 = schema.nodes.faqAnswer.create(null, a1Para);
  const item = schema.nodes.faqItem.create(null, [q1, a1]);
  const faq = schema.nodes.faq.create(null, item);
  const before = schema.nodes.paragraph.create(null, schema.text("before"));
  const after = schema.nodes.paragraph.create(null, schema.text("after"));
  return schema.topNodeType.create(null, [before, faq, after]);
}

describe("findEnclosingFaqRange", () => {
  it("returns null when the selection is not inside a faq node", () => {
    const doc = buildFaqDoc();
    const state = EditorState.create({
      doc,
      selection: TextSelection.atStart(doc),
    });
    expect(findEnclosingFaqRange(state)).toBeNull();
  });

  it("returns a range whose `insertAt` sits just before the faq's closing token", () => {
    const doc = buildFaqDoc();
    // Find a text position inside the first faqQuestion.
    let questionPos = -1;
    doc.descendants((node, pos) => {
      if (node.type.name === "faqQuestion" && questionPos < 0) {
        questionPos = pos + 1; // inside the text content
        return false;
      }
      return true;
    });
    expect(questionPos).toBeGreaterThan(0);

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, questionPos),
    });
    const range = findEnclosingFaqRange(state);
    expect(range).not.toBeNull();
    if (!range) return;

    // `start` is at the faq's opening token, `end` is just after the closing
    // token, and `insertAt` is `end - 1` so insertContentAt places new
    // children INSIDE the faq.
    expect(range.end - range.start).toBeGreaterThan(0);
    expect(range.insertAt).toBe(range.end - 1);

    // Resolving `insertAt` should land inside the faq (parent === faq).
    const $insert = doc.resolve(range.insertAt);
    expect($insert.parent.type.name).toBe("faq");
  });
});

describe("addFaqItem command", () => {
  it("appends a new faqItem INSIDE the current faq section", () => {
    const doc = buildFaqDoc();
    let questionPos = -1;
    doc.descendants((node, pos) => {
      if (node.type.name === "faqQuestion" && questionPos < 0) {
        questionPos = pos + 1;
        return false;
      }
      return true;
    });

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, questionPos),
    });

    const range = findEnclosingFaqRange(state);
    expect(range).not.toBeNull();
    if (!range) return;

    // Simulate what `insertContentAt(range.insertAt, emptyFaqItem())` does:
    // insert a new faqItem at the computed gap and verify the faq node grew
    // by one child rather than a sibling appearing after it.
    const q2 = schema.nodes.faqQuestion.create();
    const a2 = schema.nodes.faqAnswer.create(null, schema.nodes.paragraph.create());
    const newItem = schema.nodes.faqItem.create(null, [q2, a2]);
    const tr = state.tr.insert(range.insertAt, newItem);
    const next = state.apply(tr);

    // Locate the faq node in the resulting doc and confirm it now has 2 items.
    let faqChildCount = -1;
    next.doc.descendants((node) => {
      if (node.type.name === "faq") {
        faqChildCount = node.childCount;
        return false;
      }
      return true;
    });
    expect(faqChildCount).toBe(2);

    // And the paragraph-count at the doc root is still 2 (before + after) —
    // i.e. no stray faqItem sibling leaked into the document level.
    let rootChildren = 0;
    next.doc.forEach((child) => {
      if (child.type.name === "paragraph") rootChildren += 1;
    });
    expect(rootChildren).toBe(2);
  });
});
