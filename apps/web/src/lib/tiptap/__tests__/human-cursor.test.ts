import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";

import {
  HumanCursor,
  humanCursorPluginKey,
  type HumanCursorState,
} from "../human-cursor";

const extensions = [StarterKit, HumanCursor];
const schema = getSchema(extensions);

/**
 * Reach into the HumanCursor plugin's registered `decorations` prop and
 * call it against an arbitrary state. The plugin is constructed lazily by
 * the extension, so we walk the extension's `addProseMirrorPlugins()` result.
 */
function buildPluginAndState(args: {
  doc: ReturnType<typeof schema.topNodeType.create>;
  selectionAt: number;
  cursor: Partial<HumanCursorState>;
}) {
  const plugins = HumanCursor.config.addProseMirrorPlugins!.call({
    // The extension config doesn't access `this.options` for the cursor
    // plugin, so a bare cast is sufficient.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const state = EditorState.create({
    doc: args.doc,
    selection: TextSelection.create(args.doc, args.selectionAt),
    plugins,
  });
  // Drive a transaction with the cursor meta so the plugin state holds
  // the test's desired pos/visibility.
  const tr = state.tr.setMeta("humanCursor/set", args.cursor);
  return state.apply(tr);
}

describe("HumanCursor extension", () => {
  it("exports a TipTap extension named 'humanCursor'", () => {
    expect(HumanCursor.name).toBe("humanCursor");
  });

  it("exposes a stable plugin key", () => {
    // Two imports must resolve to the same key instance — ProseMirror
    // uses object identity to look the plugin state up.
    expect(humanCursorPluginKey).toBe(humanCursorPluginKey);
  });

  it("HumanCursorState type accepts the expected fields", () => {
    const state: HumanCursorState = {
      pos: 5,
      prominent: true,
      label: "Alice",
      visible: true,
    };
    expect(state.pos).toBe(5);
    expect(state.prominent).toBe(true);
    expect(state.label).toBe("Alice");
    expect(state.visible).toBe(true);
  });

  it("renders a widget decoration when the caret sits inside an EMPTY paragraph", () => {
    // Single empty paragraph: doc.content.size === 2 (`<p>` opens at 0,
    // closes at 2; the only valid in-paragraph caret position is 1).
    const emptyParagraph = schema.nodes.paragraph.create();
    const doc = schema.topNodeType.create(null, emptyParagraph);
    const state = buildPluginAndState({
      doc,
      selectionAt: 1,
      cursor: { pos: 1, visible: true, prominent: true, label: "You" },
    });

    // Pull the decoration set the plugin would hand to the editor view.
    const plugin = state.plugins.find(
      (p) => p.spec.key === humanCursorPluginKey,
    );
    expect(plugin).toBeDefined();
    const decorations = plugin!.props.decorations!.call(plugin!, state);
    expect(decorations).toBeInstanceOf(DecorationSet);

    // The decoration must exist at the empty paragraph's caret offset
    // (pos 1). `find()` with an inclusive range returns the widget so
    // the caller — and the editor view — sees a non-empty set.
    const hits = (decorations as DecorationSet).find(0, 2);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.from).toBe(1);
    expect(hits[0]?.to).toBe(1);
  });

  it("renders a widget decoration at pos 0 (before any content)", () => {
    // ProseMirror allows decorations at position 0 even before the
    // first node — verify the plugin handles that edge case so a
    // freshly-mounted editor with the caret at doc start shows the
    // human cursor immediately.
    const emptyParagraph = schema.nodes.paragraph.create();
    const doc = schema.topNodeType.create(null, emptyParagraph);
    const state = buildPluginAndState({
      doc,
      selectionAt: 1,
      cursor: { pos: 0, visible: true, prominent: true, label: "You" },
    });

    const plugin = state.plugins.find(
      (p) => p.spec.key === humanCursorPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      state,
    ) as DecorationSet;
    const hits = decorations.find(0, 2);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.from).toBe(0);
  });

  it("renders a widget decoration when the selection has a range", () => {
    // Selection of two characters across "ab" — the decoration anchors
    // at `selection.from`, matching the contract the hook implements.
    const para = schema.nodes.paragraph.create(null, schema.text("ab"));
    const doc = schema.topNodeType.create(null, para);
    const state = buildPluginAndState({
      doc,
      selectionAt: 1,
      cursor: { pos: 1, visible: true, prominent: true, label: "You" },
    });

    const plugin = state.plugins.find(
      (p) => p.spec.key === humanCursorPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      state,
    ) as DecorationSet;
    const hits = decorations.find(0, 4);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.from).toBe(1);
  });

  it("returns an empty decoration set when pos is null", () => {
    const emptyParagraph = schema.nodes.paragraph.create();
    const doc = schema.topNodeType.create(null, emptyParagraph);
    const state = buildPluginAndState({
      doc,
      selectionAt: 1,
      cursor: { pos: null, visible: false },
    });
    const plugin = state.plugins.find(
      (p) => p.spec.key === humanCursorPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      state,
    ) as DecorationSet;
    expect(decorations.find(0, 2)).toHaveLength(0);
  });
});
