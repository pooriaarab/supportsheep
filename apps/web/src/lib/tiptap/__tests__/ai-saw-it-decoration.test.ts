import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";

import {
  AiSawItDecoration,
  aiSawItPluginKey,
  allocateAiSawItId,
} from "../ai-saw-it-decoration";

const extensions = [StarterKit, AiSawItDecoration];
const schema = getSchema(extensions);

/**
 * Build a fresh ProseMirror state with the AiSawIt plugin mounted and a
 * single non-empty paragraph so positions 1..4 are valid offsets the
 * decoration can anchor against.
 */
function buildStateWithPlugin() {
  const plugins = AiSawItDecoration.config.addProseMirrorPlugins!.call(
    // The extension config doesn't access `this.options`, so a bare cast
    // is sufficient.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any,
  );
  const para = schema.nodes.paragraph.create(null, schema.text("hello"));
  const doc = schema.topNodeType.create(null, para);
  return EditorState.create({ doc, plugins });
}

describe("AiSawItDecoration extension", () => {
  it("exports a TipTap extension named 'aiSawItDecoration'", () => {
    expect(AiSawItDecoration.name).toBe("aiSawItDecoration");
  });

  it("starts with an empty decoration set", () => {
    const state = buildStateWithPlugin();
    const plugin = state.plugins.find(
      (p) => p.spec.key === aiSawItPluginKey,
    );
    expect(plugin).toBeDefined();
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      state,
    ) as DecorationSet;
    // No chips have been shown yet — set should be empty across the
    // entire doc.
    expect(decorations.find()).toHaveLength(0);
  });

  it("renders a chip at the requested position after a show meta tx", () => {
    const state = buildStateWithPlugin();
    const id = allocateAiSawItId();
    const tr = state.tr.setMeta("aiSawIt/show", {
      id,
      pos: 3,
      phase: "saw",
    });
    const next = state.apply(tr);
    const plugin = next.plugins.find(
      (p) => p.spec.key === aiSawItPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      next,
    ) as DecorationSet;
    // Decoration set must hold exactly one widget at the requested pos.
    const hits = decorations.find();
    expect(hits).toHaveLength(1);
    expect(hits[0]?.from).toBe(3);
  });

  it("evicts a chip after a hide meta tx with its id", () => {
    const state = buildStateWithPlugin();
    const id = allocateAiSawItId();
    const shown = state.apply(
      state.tr.setMeta("aiSawIt/show", { id, pos: 3, phase: "saw" }),
    );
    const hidden = shown.apply(
      shown.tr.setMeta("aiSawIt/hide", { id }),
    );
    const plugin = hidden.plugins.find(
      (p) => p.spec.key === aiSawItPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      hidden,
    ) as DecorationSet;
    expect(decorations.find()).toHaveLength(0);
  });

  it("keeps independent chips alive when one is hidden", () => {
    const state = buildStateWithPlugin();
    const idA = allocateAiSawItId();
    const idB = allocateAiSawItId();
    const both = state
      .apply(state.tr.setMeta("aiSawIt/show", { id: idA, pos: 2, phase: "saw" }))
      .apply(
        state.tr.setMeta("aiSawIt/show", { id: idB, pos: 4, phase: "saw" }),
      );
    // Hide only A — B must remain.
    const next = both.apply(both.tr.setMeta("aiSawIt/hide", { id: idA }));
    const plugin = next.plugins.find(
      (p) => p.spec.key === aiSawItPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      next,
    ) as DecorationSet;
    const hits = decorations.find();
    expect(hits).toHaveLength(1);
    // The surviving chip should sit at B's anchor position.
    expect(hits[0]?.from).toBe(4);
  });

  it("allocates monotonically-increasing ids", () => {
    const a = allocateAiSawItId();
    const b = allocateAiSawItId();
    const c = allocateAiSawItId();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
