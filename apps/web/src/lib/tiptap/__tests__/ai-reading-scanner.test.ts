import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";

import {
  AiReadingScanner,
  aiReadingScannerPluginKey,
  allocateAiReadingScanId,
} from "../ai-reading-scanner";

const extensions = [StarterKit, AiReadingScanner];
const schema = getSchema(extensions);

/**
 * Build a fresh ProseMirror state with the AiReadingScanner plugin
 * mounted and a single non-empty paragraph so positions 1..6 are valid
 * offsets the decoration can anchor against.
 */
function buildStateWithPlugin() {
  const plugins = AiReadingScanner.config.addProseMirrorPlugins!.call(
    // The extension config doesn't access `this.options`, so a bare cast
    // is sufficient.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any,
  );
  const para = schema.nodes.paragraph.create(null, schema.text("hello!"));
  const doc = schema.topNodeType.create(null, para);
  return EditorState.create({ doc, plugins });
}

describe("AiReadingScanner extension", () => {
  it("exports a TipTap extension named 'aiReadingScanner'", () => {
    expect(AiReadingScanner.name).toBe("aiReadingScanner");
  });

  it("starts with an empty decoration set", () => {
    const state = buildStateWithPlugin();
    const plugin = state.plugins.find(
      (p) => p.spec.key === aiReadingScannerPluginKey,
    );
    expect(plugin).toBeDefined();
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      state,
    ) as DecorationSet;
    // No sweeps have been triggered yet — set should be empty across the
    // entire doc.
    expect(decorations.find()).toHaveLength(0);
  });

  it("renders an inline decoration spanning the swept range", () => {
    const state = buildStateWithPlugin();
    const id = allocateAiReadingScanId();
    const tr = state.tr.setMeta("aiReadingScanner/trigger", {
      id,
      from: 1,
      to: 4,
    });
    const next = state.apply(tr);
    const plugin = next.plugins.find(
      (p) => p.spec.key === aiReadingScannerPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      next,
    ) as DecorationSet;
    const hits = decorations.find();
    expect(hits).toHaveLength(1);
    expect(hits[0]?.from).toBe(1);
    expect(hits[0]?.to).toBe(4);
  });

  it("evicts a sweep after a clear meta tx with its id", () => {
    const state = buildStateWithPlugin();
    const id = allocateAiReadingScanId();
    const shown = state.apply(
      state.tr.setMeta("aiReadingScanner/trigger", { id, from: 1, to: 4 }),
    );
    const hidden = shown.apply(
      shown.tr.setMeta("aiReadingScanner/clear", { id }),
    );
    const plugin = hidden.plugins.find(
      (p) => p.spec.key === aiReadingScannerPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      hidden,
    ) as DecorationSet;
    expect(decorations.find()).toHaveLength(0);
  });

  it("keeps independent sweeps alive when one is cleared", () => {
    const state = buildStateWithPlugin();
    const idA = allocateAiReadingScanId();
    const idB = allocateAiReadingScanId();
    const both = state
      .apply(
        state.tr.setMeta("aiReadingScanner/trigger", {
          id: idA,
          from: 1,
          to: 3,
        }),
      )
      .apply(
        state.tr.setMeta("aiReadingScanner/trigger", {
          id: idB,
          from: 4,
          to: 6,
        }),
      );
    // Clear only A — B must remain.
    const next = both.apply(
      both.tr.setMeta("aiReadingScanner/clear", { id: idA }),
    );
    const plugin = next.plugins.find(
      (p) => p.spec.key === aiReadingScannerPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      next,
    ) as DecorationSet;
    const hits = decorations.find();
    expect(hits).toHaveLength(1);
    expect(hits[0]?.from).toBe(4);
    expect(hits[0]?.to).toBe(6);
  });

  it("normalises reversed ranges so from <= to", () => {
    const state = buildStateWithPlugin();
    const id = allocateAiReadingScanId();
    // Caller accidentally passes max as `from`, min as `to` — the plugin
    // must still produce a valid sweep over `[1, 4)`.
    const tr = state.tr.setMeta("aiReadingScanner/trigger", {
      id,
      from: 4,
      to: 1,
    });
    const next = state.apply(tr);
    const plugin = next.plugins.find(
      (p) => p.spec.key === aiReadingScannerPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      next,
    ) as DecorationSet;
    const hits = decorations.find();
    expect(hits).toHaveLength(1);
    expect(hits[0]?.from).toBe(1);
    expect(hits[0]?.to).toBe(4);
  });

  it("ignores collapsed ranges (from === to)", () => {
    const state = buildStateWithPlugin();
    const id = allocateAiReadingScanId();
    const tr = state.tr.setMeta("aiReadingScanner/trigger", {
      id,
      from: 2,
      to: 2,
    });
    const next = state.apply(tr);
    const plugin = next.plugins.find(
      (p) => p.spec.key === aiReadingScannerPluginKey,
    );
    const decorations = plugin!.props.decorations!.call(
      plugin!,
      next,
    ) as DecorationSet;
    expect(decorations.find()).toHaveLength(0);
  });

  it("allocates monotonically-increasing ids", () => {
    const a = allocateAiReadingScanId();
    const b = allocateAiReadingScanId();
    const c = allocateAiReadingScanId();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
