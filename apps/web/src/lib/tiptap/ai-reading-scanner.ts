/**
 * AI Reading Scanner TipTap Extension — visible "the AI just read this"
 * sweep across a user's freshly-typed range. Makes the bidirectional
 * canvas bridge feel tangible: the moment a debounced user-edit cue
 * leaves the local client, a soft yellow gradient slides across the
 * exact span of text the user just added, like a reader's finger
 * tracking a sentence from left to right.
 *
 * Lifecycle:
 *   1. The user finishes a burst of edits. `use-canvas-editor-sync`
 *      debounces (400ms) and asks for a summary; if non-null and the
 *      cue dispatcher returns `true`, the canvas-collaborative-editor
 *      calls `editor.commands.triggerAiReadingScan({ from, to })` with
 *      the range of the user's added content.
 *   2. The plugin allocates a monotonically-increasing id, stores the
 *      range + id in its state, and renders an inline ProseMirror
 *      decoration that overlays the range with a `linear-gradient`
 *      sliding via a CSS `translateX` keyframe (`ai-reading-scan-sweep`
 *      in globals.css). The sweep takes ~600ms; the entry self-evicts
 *      shortly afterward so the doc isn't littered with stale ranges.
 *   3. Re-mapping: every transaction maps each entry's stored
 *      from/to through `tr.mapping` so a follow-up AI diff or further
 *      typing keeps the highlight anchored at the right offsets (same
 *      defensive pattern used by `ai-cursor.ts`, `human-cursor.ts`,
 *      and `ai-saw-it-decoration.ts`).
 *
 * References:
 *   - https://prosemirror.net/docs/ref/#view.Decoration.inline
 *   - https://tiptap.dev/api/extensions/highlight (palette parity with the
 *     yellow highlight users already see on `apply_highlight` tool calls).
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * One in-flight sweep. The plugin renders a single inline decoration
 * per entry spanning `[from, to)`; the sweep itself is driven by a CSS
 * keyframe attached to the rendered DOM, so the plugin only owns the
 * range — not the animation timeline.
 */
export interface AiReadingScannerEntry {
  /** Monotonically-increasing id — used by `clearAiReadingScan` to evict
   *  a specific sweep without disturbing peers from other bursts. */
  id: number;
  /** ProseMirror "from" position of the swept range. */
  from: number;
  /** ProseMirror "to" position of the swept range. */
  to: number;
}

export interface AiReadingScannerState {
  entries: AiReadingScannerEntry[];
}

const INITIAL_STATE: AiReadingScannerState = { entries: [] };

export const aiReadingScannerPluginKey = new PluginKey<AiReadingScannerState>(
  "aiReadingScanner",
);

const META_TRIGGER = "aiReadingScanner/trigger";
const META_CLEAR = "aiReadingScanner/clear";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiReadingScanner: {
      /**
       * Start a sweep over `[from, to)`. Returns immediately; the sweep
       * animates via CSS and the plugin holds the decoration until
       * `clearAiReadingScan({ id })` is dispatched (or a future sweep
       * with the same id supersedes this one).
       */
      triggerAiReadingScan: (entry: {
        id?: number;
        from: number;
        to: number;
      }) => ReturnType;
      /** Remove a sweep by id. No-op when the id is unknown. */
      clearAiReadingScan: (entry: { id: number }) => ReturnType;
    };
  }
}

/** Counter for sweep ids — module-scoped so independent editor mounts
 *  don't reuse ids across remounts (which would risk a stale clear
 *  timer evicting a fresh sweep on a future burst). */
let nextSweepId = 1;

/** Allocate a fresh sweep id. Exported so the React layer can reserve
 *  an id up-front before calling `triggerAiReadingScan`, then keep
 *  referencing the same id when it later schedules a `clearAiReadingScan`. */
export function allocateAiReadingScanId(): number {
  const id = nextSweepId;
  nextSweepId += 1;
  return id;
}

/**
 * Clamp a stored position into the valid document range so a stale
 * offset arriving after a `setContent` (which shrinks/replaces the
 * doc) never triggers a ProseMirror invariant violation.
 */
function clampPos(pos: number, docSize: number): number {
  if (pos < 0) return 0;
  if (pos > docSize) return docSize;
  return pos;
}

/**
 * Normalise a `[from, to)` range so `from <= to` and both ends are
 * clamped into the doc range. A caller that captured the burst's
 * min/max positions in either order still produces a valid sweep.
 */
function normaliseRange(
  from: number,
  to: number,
  docSize: number,
): { from: number; to: number } | null {
  const a = clampPos(Math.min(from, to), docSize);
  const b = clampPos(Math.max(from, to), docSize);
  if (a === b) return null;
  return { from: a, to: b };
}

export const AiReadingScanner = Extension.create({
  name: "aiReadingScanner",

  addCommands() {
    return {
      triggerAiReadingScan:
        (entry: { id?: number; from: number; to: number }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const id = entry.id ?? allocateAiReadingScanId();
            tr.setMeta(META_TRIGGER, {
              id,
              from: entry.from,
              to: entry.to,
            });
            dispatch(tr);
          }
          return true;
        },
      clearAiReadingScan:
        (entry: { id: number }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(META_CLEAR, { id: entry.id });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<AiReadingScannerState>({
        key: aiReadingScannerPluginKey,
        state: {
          init: () => INITIAL_STATE,
          apply(tr, prev): AiReadingScannerState {
            const docSize = tr.doc.content.size;
            let entries = prev.entries;

            // Re-map every entry's range through this transaction's
            // mapping so structural edits keep the highlight anchored at
            // the right offsets. Entries whose `from`/`to` collapse to
            // the same point after mapping (the swept text was deleted)
            // are evicted entirely — there's nothing left to highlight.
            if (tr.docChanged && entries.length > 0) {
              const remapped: AiReadingScannerEntry[] = [];
              for (const e of entries) {
                const from = clampPos(tr.mapping.map(e.from), docSize);
                const to = clampPos(tr.mapping.map(e.to), docSize);
                if (from < to) remapped.push({ id: e.id, from, to });
              }
              entries = remapped;
            }

            const trigger = tr.getMeta(META_TRIGGER) as
              | { id: number; from: number; to: number }
              | undefined;
            if (trigger) {
              const range = normaliseRange(trigger.from, trigger.to, docSize);
              if (range) {
                const idx = entries.findIndex((e) => e.id === trigger.id);
                if (idx === -1) {
                  entries = [
                    ...entries,
                    { id: trigger.id, from: range.from, to: range.to },
                  ];
                } else {
                  entries = entries.map((e, i) =>
                    i === idx
                      ? { ...e, from: range.from, to: range.to }
                      : e,
                  );
                }
              }
            }

            const clear = tr.getMeta(META_CLEAR) as { id: number } | undefined;
            if (clear) {
              entries = entries.filter((e) => e.id !== clear.id);
            }

            if (entries === prev.entries) return prev;
            return { entries };
          },
        },
        props: {
          decorations(state) {
            const value = aiReadingScannerPluginKey.getState(state);
            if (!value || value.entries.length === 0) {
              return DecorationSet.empty;
            }
            const docSize = state.doc.content.size;
            const decos: Decoration[] = [];
            for (const entry of value.entries) {
              const from = clampPos(entry.from, docSize);
              const to = clampPos(entry.to, docSize);
              if (from >= to) continue;
              // Inline decoration spans the swept range and tags the
              // wrapper element with the `ai-reading-scan-target` class.
              // The class hooks into a CSS keyframe defined in globals.css
              // that drives the gradient sweep — keeping all motion in
              // CSS means the plugin doesn't need a JS animation loop or
              // a per-frame React render. The `data-scan-id` attribute
              // lets tests target the specific sweep when multiple
              // overlap.
              decos.push(
                Decoration.inline(
                  from,
                  to,
                  {
                    class: "ai-reading-scan-target",
                    "data-testid": "ai-reading-scan-target",
                    "data-scan-id": String(entry.id),
                  },
                  // Stamp inclusive endpoints so the decoration follows
                  // text inserted *inside* the range (defensive — by the
                  // time we render, the user's burst is done, but a
                  // late-arriving AI diff inside the same span shouldn't
                  // visually shrink the sweep mid-animation).
                  { inclusiveStart: false, inclusiveEnd: false },
                ),
              );
            }
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
