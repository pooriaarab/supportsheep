/**
 * AI Cursor TipTap Extension — collaborator-style remote cursor for the
 * AI writer. Renders an inline widget decoration at the document position
 * the AI most recently wrote at (NOT pinned to the right edge of the
 * canvas container), so the caret reads like a teammate's cursor in
 * Google Docs / Liveblocks / Y.js — landing between the actual characters
 * the AI just produced.
 *
 * State is held in a ProseMirror plugin so position updates land inside
 * the editor's transaction lifecycle. The plugin recomputes its
 * decoration set on every transaction and re-maps the cursor position
 * through transaction steps so a follow-up `setContent` does not strand
 * the cursor at a stale offset.
 *
 * Updates flow in via the `setAiCursor` editor command:
 *   editor.commands.setAiCursor({ pos, active, label })
 *
 * The widget DOM mirrors the shape produced by `CanvasCursor` (chip +
 * blinking bar) so the existing `canvas-cursor-blink` keyframe and
 * test selectors continue to match. The chip floats above the caret
 * via absolute positioning so it doesn't push surrounding inline text.
 *
 * References:
 *   - https://tiptap.dev/api/extensions/collaboration-cursor
 *   - https://prosemirror.net/docs/ref/#view.Decoration
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface AiCursorState {
  /** Document position where the AI's caret should render. `null` hides it. */
  pos: number | null;
  /** True while the writer-worker is actively appending. Drives the
   *  opacity transition that lets the cursor fade out when idle. */
  active: boolean;
  /** Display label shown in the chip above the caret. */
  label: string;
  /** Optional brief position override that supersedes `pos` while set.
   *  Used to "snap" the AI cursor to a different spot for a moment
   *  (e.g. peeking at the end of the user's freshly-typed content
   *  during a reading-scanner sweep) and then automatically revert.
   *  `null` means no override is active — the cursor renders at `pos`. */
  peekPos: number | null;
}

const INITIAL_STATE: AiCursorState = {
  pos: null,
  active: false,
  label: "AI",
  peekPos: null,
};

export const aiCursorPluginKey = new PluginKey<AiCursorState>("aiCursor");

const META_KEY = "aiCursor/set";
const META_PEEK = "aiCursor/peek";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiCursor: {
      /**
       * Set the AI cursor's position and active flag. Pass `pos: null` or
       * `active: false` to hide / fade out the cursor.
       */
      setAiCursor: (state: Partial<AiCursorState>) => ReturnType;
      /**
       * Temporarily snap the AI cursor to a different document position
       * (e.g. the end of the user's freshly-typed content) without
       * disturbing the underlying `pos` the writer-worker is tracking.
       * Pass `pos: null` to clear the override and let the cursor return
       * to its base position. The caller owns the timing — the plugin
       * does not auto-revert, since the natural revert point varies with
       * the surrounding interaction (typically ~700ms, lined up with the
       * reading-scanner sweep length plus a short hold).
       */
      peekAiCursor: (entry: { pos: number | null }) => ReturnType;
    };
  }
}

/**
 * Build the widget DOM for the AI cursor. Matches the markup shape and
 * class hooks of `CanvasCursor` so the same CSS keyframe (defined in
 * globals.css) and the `canvas-cursor` test selectors apply.
 *
 * The wrapper is a *true inline* span so ProseMirror anchors it at the
 * exact text offset of the decoration — between the characters the AI
 * just produced, not floated off to a corner of the editor container.
 * The blinking bar is a small `inline-block` with explicit pixel width
 * and `1em` height so it aligns vertically with surrounding glyphs the
 * way a normal text caret does. The chip is the only absolutely
 * positioned piece, anchored above the bar via a `position: relative`
 * span so the chip floats without pushing inline text sideways.
 */
function buildCursorDom(state: AiCursorState): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.setAttribute("data-testid", "canvas-cursor");
  wrapper.setAttribute("data-active", state.active ? "true" : "false");
  // Plain inline — NO `position: absolute`, NO width override. ProseMirror
  // places this exactly where the decoration's resolved doc position
  // falls, between characters, the same way a remote collaborator's
  // caret renders in Y.js / Liveblocks. An absolute or right-aligned
  // wrapper would strand the bar at the container edge regardless of
  // where the AI actually wrote.
  wrapper.className = [
    "canvas-cursor-widget",
    "pointer-events-none inline align-baseline",
    // `transition-opacity` keeps the fade-in/out smooth; `transition-transform`
    // on the inner bar + chip lets them slide rather than jump when the
    // typewriter advances the caret a few pixels per tick. 60 ms linear
    // matches the typewriter's per-tick cadence so the slide finishes
    // just as the next character lands. Combined under `motion-safe:`
    // so reduced-motion preferences disable both.
    "motion-safe:transition-opacity motion-safe:duration-500",
    "motion-safe:[&_[data-testid='canvas-cursor-bar']]:transition-transform",
    "motion-safe:[&_[data-testid='canvas-cursor-bar']]:duration-[60ms]",
    "motion-safe:[&_[data-testid='canvas-cursor-bar']]:ease-linear",
    "motion-safe:[&_[data-testid='canvas-cursor-chip']]:transition-transform",
    "motion-safe:[&_[data-testid='canvas-cursor-chip']]:duration-[60ms]",
    "motion-safe:[&_[data-testid='canvas-cursor-chip']]:ease-linear",
    state.active ? "opacity-100" : "opacity-0",
  ].join(" ");

  // Anchor wraps the bar in a `position: relative` inline-block so the
  // chip can float above the bar via `position: absolute` without
  // disturbing the surrounding line box. Width matches the bar exactly
  // (2px) so the cursor adds the minimum possible horizontal advance.
  const anchor = document.createElement("span");
  anchor.className = "relative inline-block align-baseline";
  anchor.style.width = "2px";
  anchor.style.height = "1em";

  const chip = document.createElement("span");
  chip.setAttribute("data-testid", "canvas-cursor-chip");
  chip.className = [
    "absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap",
    "inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5",
    "text-[9px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm",
  ].join(" ");
  chip.textContent = state.label;

  const bar = document.createElement("span");
  bar.setAttribute("data-testid", "canvas-cursor-bar");
  bar.className = [
    "inline-block h-[1em] w-[2px] rounded-sm bg-primary align-baseline",
    "motion-safe:[animation:canvas-cursor-blink_1s_ease-in-out_infinite]",
  ].join(" ");

  anchor.appendChild(chip);
  anchor.appendChild(bar);
  wrapper.appendChild(anchor);
  return wrapper;
}

/**
 * Clamp a position into the valid document range so a stale offset
 * arriving after a `setContent` (which shrinks/replaces the doc) never
 * triggers a ProseMirror invariant violation. Bounded at
 * `[0, doc.content.size]` — the open ranges ProseMirror accepts.
 */
function clampPos(pos: number, docSize: number): number {
  if (pos < 0) return 0;
  if (pos > docSize) return docSize;
  return pos;
}

export const AiCursor = Extension.create({
  name: "aiCursor",

  addCommands() {
    return {
      setAiCursor:
        (next: Partial<AiCursorState>) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(META_KEY, next);
            dispatch(tr);
          }
          return true;
        },
      peekAiCursor:
        (entry: { pos: number | null }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(META_PEEK, entry);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<AiCursorState>({
        key: aiCursorPluginKey,
        state: {
          init: () => INITIAL_STATE,
          apply(tr, prev) {
            const meta = tr.getMeta(META_KEY) as Partial<AiCursorState> | undefined;
            const peekMeta = tr.getMeta(META_PEEK) as
              | { pos: number | null }
              | undefined;
            // Re-map the stored position through this transaction's
            // steps so an upstream `setContent` or human edit doesn't
            // strand the cursor at a now-invalid offset. ProseMirror's
            // `mapping` handles this for any pos that survived the change.
            // The same re-mapping applies to `peekPos` so a brief snap
            // override survives an in-flight typewriter tick.
            let next: AiCursorState = prev;
            if (tr.docChanged) {
              const docSize = tr.doc.content.size;
              next = {
                ...prev,
                pos:
                  prev.pos === null
                    ? null
                    : clampPos(tr.mapping.map(prev.pos), docSize),
                peekPos:
                  prev.peekPos === null
                    ? null
                    : clampPos(tr.mapping.map(prev.peekPos), docSize),
              };
            }
            if (meta) {
              next = {
                ...next,
                pos:
                  meta.pos === undefined
                    ? next.pos
                    : meta.pos === null
                      ? null
                      : clampPos(meta.pos, tr.doc.content.size),
                active: meta.active ?? next.active,
                label: meta.label ?? next.label,
              };
            }
            if (peekMeta) {
              next = {
                ...next,
                peekPos:
                  peekMeta.pos === null
                    ? null
                    : clampPos(peekMeta.pos, tr.doc.content.size),
              };
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            const cursor = aiCursorPluginKey.getState(state);
            // The effective render position is the peek override when
            // one is set (mid reading-scan snap), otherwise the writer-
            // tracked base position. A peek override force-shows the
            // cursor even when the writer is idle so the user sees the
            // AI "look at" their edit even if no streaming write is in
            // flight yet.
            if (!cursor) return DecorationSet.empty;
            const effectivePos = cursor.peekPos ?? cursor.pos;
            const isActive = cursor.active || cursor.peekPos !== null;
            if (effectivePos === null || !isActive) {
              return DecorationSet.empty;
            }
            const docSize = state.doc.content.size;
            const pos = clampPos(effectivePos, docSize);
            return DecorationSet.create(state.doc, [
              Decoration.widget(pos, () => buildCursorDom(cursor), {
                // Side > 0 keeps the widget after the position on
                // re-renders, so incoming characters appear to the LEFT
                // of the caret (matching how a normal text caret reads).
                side: 1,
                // Stamp a key so ProseMirror re-uses the widget DOM
                // when only the label changes — keeps the CSS opacity
                // transition smooth instead of resetting.
                key: `ai-cursor:${cursor.label}`,
              }),
            ]);
          },
        },
      }),
    ];
  },
});
