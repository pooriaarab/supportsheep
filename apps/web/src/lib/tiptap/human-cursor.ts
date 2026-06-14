/**
 * Human Cursor TipTap Extension — collaborator-style cursor for the
 * HUMAN editor, mirroring the `AiCursor` extension on the AI side. Renders
 * an inline widget decoration at the human's caret position so the
 * canvas reads like a Figma / Google-Docs / Liveblocks file with both
 * editors visible at once: a warm-green "human" caret with a name chip
 * sitting next to the cool-primary AI caret.
 *
 * Why a separate plugin from `AiCursor`:
 *   - Different visual accent (success-green vs primary-blue) so the
 *     two cursors are instantly distinguishable.
 *   - Inverted prominence policy — the AI caret fades when idle, the
 *     human caret fades when ACTIVELY typing (the user doesn't need a
 *     labelled cursor on themselves while their fingers are on the
 *     keys) and fades IN when idle or when the AI is also editing.
 *   - Keeps the AI cursor's W21.A inline-position fix and `active`
 *     debounce logic untouched.
 *
 * Updates flow in via the `setHumanCursor` editor command:
 *   editor.commands.setHumanCursor({ pos, prominent, label, visible })
 *
 * Where `prominent` controls the high-opacity state (chip + bar visible)
 * vs the low-opacity "subtle" state (faint bar, chip nearly invisible)
 * that the human sees while they're actively typing, and `visible`
 * controls whether the decoration renders at all — flipped to `false`
 * on editor blur so the green cursor doesn't linger on screen when the
 * user clicks somewhere outside the document. The widget stays mounted
 * across visibility toggles so the CSS opacity transition produces a
 * smooth 200ms crossfade rather than a hard pop.
 *
 * Native browser caret: when the decoration is active (`visible &&
 * pos !== null`), the plugin tags the contenteditable element with a
 * `has-human-cursor` class so globals.css can hide the white native
 * caret via `caret-color: transparent`. Without that, both cursors
 * render at the same offset and the canvas appears to have a
 * double-cursor bug.
 *
 * References:
 *   - https://tiptap.dev/api/extensions/collaboration-cursor
 *   - https://prosemirror.net/docs/ref/#view.Decoration
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface HumanCursorState {
  /** Document position where the human's caret should render. `null` hides it. */
  pos: number | null;
  /** True when the caret should be fully visible (idle or AI co-editing).
   *  False during active typing so the user isn't distracted by a chip
   *  hovering over their own cursor. */
  prominent: boolean;
  /** Display label shown in the chip above the caret (user's display name). */
  label: string;
  /** True when the cursor decoration should be rendered as visible. Decoupled
   *  from `pos` so the widget can stay mounted at its last known offset and
   *  smoothly fade in/out via CSS opacity transitions when the editor gains
   *  or loses focus — rather than mount/unmount popping it in abruptly. */
  visible: boolean;
}

const INITIAL_STATE: HumanCursorState = {
  pos: null,
  prominent: false,
  label: "You",
  visible: false,
};

export const humanCursorPluginKey = new PluginKey<HumanCursorState>(
  "humanCursor",
);

const META_KEY = "humanCursor/set";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    humanCursor: {
      /**
       * Set the human cursor's position and prominence. Pass `pos: null`
       * to hide it entirely.
       */
      setHumanCursor: (state: Partial<HumanCursorState>) => ReturnType;
    };
  }
}

/**
 * Build the widget DOM for the human cursor. Mirrors the markup shape
 * of `AiCursor` (true inline anchor → in-flow blinking bar + absolutely
 * positioned chip) so the same `canvas-cursor-blink` keyframe applies,
 * but tinted with the `bg-success` semantic token so the human's caret
 * reads as a distinct collaborator next to the AI's primary-tinted caret.
 *
 * The bar is kept **in flow** (`inline-block`, NOT absolute) so the
 * widget always claims layout space — including inside an empty paragraph
 * where the parent block has no other inline content. An absolutely
 * positioned bar inside a zero-width wrapper would collapse to nothing
 * when the surrounding block has no text to establish a line box, leaving
 * the user with no visible cursor on a fresh empty paragraph.
 *
 * Wrapped in `pointer-events: none` so the decoration can never swallow
 * clicks or interfere with the native text caret.
 */
function buildCursorDom(state: HumanCursorState): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.setAttribute("data-testid", "human-cursor");
  wrapper.setAttribute("data-prominent", state.prominent ? "true" : "false");
  wrapper.setAttribute("data-visible", state.visible ? "true" : "false");
  // Resolve the target opacity:
  //   - hidden (editor blurred / not yet active) → 0
  //   - visible + actively typing → 20 (subtle bar, no chip)
  //   - visible + idle / AI co-editing → 100 (chip fades in)
  // The 200ms `transition-opacity` smooths each transition so the cursor
  // never pops on or off abruptly when focus or AI state flips.
  const opacityClass = !state.visible
    ? "opacity-0"
    : state.prominent
      ? "opacity-100"
      : "opacity-20";
  // Plain inline wrapper (NOT inline-block with width:0) so ProseMirror
  // anchors the widget at the exact text offset of the decoration —
  // matching how `AiCursor` and standard collaborator carets render.
  wrapper.className = [
    "human-cursor-widget",
    "pointer-events-none inline align-baseline",
    "motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out",
    opacityClass,
  ].join(" ");

  // Anchor establishes a `position: relative` line box so the chip can
  // float above the bar via `position: absolute` without disturbing
  // surrounding inline text. Width matches the bar (2px) so the cursor
  // adds the minimum possible horizontal advance.
  const anchor = document.createElement("span");
  anchor.className = "relative inline-block align-baseline";
  anchor.style.width = "2px";
  anchor.style.height = "1em";

  const chip = document.createElement("span");
  chip.setAttribute("data-testid", "human-cursor-chip");
  chip.className = [
    "absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap",
    "inline-flex items-center gap-1 rounded-full bg-success px-1.5 py-0.5",
    "text-[9px] font-semibold uppercase tracking-wide text-success-foreground shadow-sm",
    "motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out",
    // Chip is fully hidden during active typing; only the bar peeks
    // through so the user can still see roughly where the decoration
    // lives without a label hovering over their own caret.
    state.prominent ? "opacity-100" : "opacity-0",
  ].join(" ");
  chip.textContent = state.label;

  // Bar is kept in flow (inline-block) so the widget claims a real line
  // box even when its parent paragraph is empty — without this the bar
  // disappears the moment the caret lands on a node with no text content.
  const bar = document.createElement("span");
  bar.setAttribute("data-testid", "human-cursor-bar");
  bar.className = [
    "inline-block h-[1em] w-[2px] rounded-sm bg-success align-baseline",
    "motion-safe:[animation:canvas-cursor-blink_1s_ease-in-out_infinite]",
  ].join(" ");

  anchor.appendChild(chip);
  anchor.appendChild(bar);
  wrapper.appendChild(anchor);
  return wrapper;
}

/**
 * Clamp a position into the valid document range so a stale offset
 * (after a `setContent` from an AI diff) never triggers a ProseMirror
 * invariant violation. Bounded at `[0, doc.content.size]`.
 */
function clampPos(pos: number, docSize: number): number {
  if (pos < 0) return 0;
  if (pos > docSize) return docSize;
  return pos;
}

export const HumanCursor = Extension.create({
  name: "humanCursor",

  addCommands() {
    return {
      setHumanCursor:
        (next: Partial<HumanCursorState>) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(META_KEY, next);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<HumanCursorState>({
        key: humanCursorPluginKey,
        state: {
          init: () => INITIAL_STATE,
          apply(tr, prev) {
            const meta = tr.getMeta(META_KEY) as
              | Partial<HumanCursorState>
              | undefined;
            // Re-map the stored position through this transaction's
            // steps so an incoming AI `setContent` or a structural edit
            // doesn't strand the cursor at a now-invalid offset.
            let next: HumanCursorState = prev;
            if (prev.pos !== null && tr.docChanged) {
              const mapped = tr.mapping.map(prev.pos);
              next = { ...prev, pos: clampPos(mapped, tr.doc.content.size) };
            }
            if (meta) {
              next = {
                pos:
                  meta.pos === undefined
                    ? next.pos
                    : meta.pos === null
                      ? null
                      : clampPos(meta.pos, tr.doc.content.size),
                prominent: meta.prominent ?? next.prominent,
                label: meta.label ?? next.label,
                visible: meta.visible ?? next.visible,
              };
            }
            return next;
          },
        },
        props: {
          // Add a `has-human-cursor` class to the contenteditable element
          // whenever the decoration is showing, so globals.css can hide
          // the native browser caret (`caret-color: transparent`) and
          // leave only the labelled green cursor visible. Without this,
          // both the native white caret and our green widget render
          // simultaneously, producing a confusing "two cursors" effect.
          attributes(state): { [name: string]: string } {
            const cursor = humanCursorPluginKey.getState(state);
            if (cursor && cursor.visible && cursor.pos !== null) {
              return { class: "has-human-cursor" };
            }
            return {};
          },
          decorations(state) {
            const cursor = humanCursorPluginKey.getState(state);
            if (!cursor || cursor.pos === null) return DecorationSet.empty;
            const docSize = state.doc.content.size;
            const pos = clampPos(cursor.pos, docSize);
            return DecorationSet.create(state.doc, [
              Decoration.widget(pos, () => buildCursorDom(cursor), {
                // Side > 0 keeps the widget after the position so
                // newly-typed characters appear to the LEFT of the
                // caret — matching native text-caret behaviour.
                side: 1,
                // Key by the rendered-state fields so ProseMirror
                // re-uses the same DOM when only the prominent or
                // visible flag changes, letting the CSS opacity
                // transition play instead of resetting.
                key: `human-cursor:${cursor.label}`,
              }),
            ]);
          },
        },
      }),
    ];
  },
});
