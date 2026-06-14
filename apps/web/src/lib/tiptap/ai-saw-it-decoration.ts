/**
 * AI Saw It TipTap Extension — locational, inline confirmation that the
 * AI received the user's most-recent edit. Renders a small floating chip
 * as a ProseMirror widget decoration AT THE POSITION the user just typed
 * at, then auto-fades after a short window. Mirrors the way Figma /
 * Notion / Google Docs surface collaborator activity INLINE near the
 * actual edit, rather than as a top-of-canvas banner.
 *
 * Lifecycle:
 *   1. The user finishes a burst of edits. `use-canvas-editor-sync`
 *      debounces (400ms) and asks for a summary; if non-null and the
 *      cue dispatcher returns `true`, the canvas-collaborative-editor
 *      calls `editor.commands.showAiSawIt({ pos, phase: "saw" })` to
 *      drop a chip at that document position.
 *   2. After `AI_SAW_IT_FADE_MS` (2.5s) the React layer dispatches
 *      `hideAiSawIt({ id })` to remove the chip. Each chip is uniquely
 *      identified by a monotonically-increasing id so multiple bursts
 *      in different sections can coexist and fade independently.
 *
 * Position re-mapping: every transaction maps each chip's stored
 * position through `tr.mapping` so a follow-up AI diff or further user
 * typing doesn't strand the chip at a now-invalid offset (same
 * defensive pattern used by `ai-cursor.ts` and `human-cursor.ts`).
 *
 * References:
 *   - https://prosemirror.net/docs/ref/#view.Decoration
 *   - https://tiptap.dev/api/extensions/collaboration-cursor (palette
 *     parity with the existing AI cursor chip).
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Display phase for an `AiSawIt` chip.
 *   `reading` — placeholder phase (kept in the API for future two-phase
 *               flows where the chip needs to surface while the cue is
 *               in-flight). The pencil icon variant is rendered here.
 *   `saw`     — the cue dispatcher returned `true` (the cue successfully
 *               left the local client). The chip text reads "AI saw
 *               this" with a checkmark.
 */
export type AiSawItPhase = "reading" | "saw";

export interface AiSawItEntry {
  /** Monotonically-increasing id — used by `hideAiSawIt` to evict a
   *  specific chip without disturbing peers from other bursts. */
  id: number;
  /** Document position where the chip's widget is anchored. Re-mapped
   *  through every transaction so structural edits don't strand it. */
  pos: number;
  /** Display phase that drives the chip's icon + label. */
  phase: AiSawItPhase;
}

export interface AiSawItState {
  entries: AiSawItEntry[];
}

const INITIAL_STATE: AiSawItState = { entries: [] };

export const aiSawItPluginKey = new PluginKey<AiSawItState>("aiSawIt");

const META_SHOW = "aiSawIt/show";
const META_HIDE = "aiSawIt/hide";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiSawIt: {
      /**
       * Add or update a chip at the given document position. Passing an
       * existing `id` updates the chip's `phase` in place (used to flip
       * from `"reading"` to `"saw"` without re-mounting the widget DOM,
       * so the CSS transition stays smooth). Omitting `id` adds a new
       * chip whose id is allocated by the plugin.
       */
      showAiSawIt: (entry: {
        id?: number;
        pos: number;
        phase: AiSawItPhase;
      }) => ReturnType;
      /** Remove a chip by id. No-op when the id is unknown (e.g. the
       *  user navigated away or a competing transaction already evicted
       *  it). */
      hideAiSawIt: (entry: { id: number }) => ReturnType;
    };
  }
}

/** Counter for chip ids — module-scoped so independent editor mounts
 *  don't reuse ids across remounts (which would risk a stale fade
 *  timer evicting a fresh chip on a future burst). */
let nextChipId = 1;

/** Allocate a fresh chip id. Exported so the React layer can reserve
 *  an id up-front before calling `showAiSawIt`, then keep referencing
 *  the same id when it later flips phase or schedules a `hideAiSawIt`. */
export function allocateAiSawItId(): number {
  const id = nextChipId;
  nextChipId += 1;
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
 * Build the chip widget DOM. Mirrors the visual language of the AI
 * cursor's name chip (`bg-primary` pill, white foreground, 9px uppercase
 * caps) so the inline acknowledgment reads as a sibling of the AI's
 * collaborator caret rather than a separate UI surface.
 *
 * The wrapper is a plain inline span so ProseMirror anchors it exactly
 * at the decoration's resolved doc offset — between characters, the
 * same way a remote collaborator's caret renders. The chip itself
 * floats above the baseline via an absolutely-positioned inner span so
 * it doesn't push surrounding inline text sideways. Wrapped in
 * `pointer-events: none` so it never swallows clicks on the surrounding
 * prose.
 */
function buildChipDom(entry: AiSawItEntry): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.setAttribute("data-testid", "ai-saw-it-chip");
  wrapper.setAttribute("data-phase", entry.phase);
  wrapper.setAttribute("data-chip-id", String(entry.id));
  wrapper.className = [
    "ai-saw-it-widget",
    "pointer-events-none inline align-baseline",
    // Smooth opacity transition so the React layer's `hideAiSawIt`
    // produces a 250ms fade rather than a hard pop. Combined under
    // `motion-safe:` so reduced-motion preferences disable it.
    "motion-safe:transition-opacity motion-safe:duration-[250ms] motion-safe:ease-out",
  ].join(" ");

  // Anchor establishes a relative line box for the absolutely positioned
  // chip. Zero-width inline-block so the chip floats above without
  // claiming any horizontal advance in the prose flow.
  const anchor = document.createElement("span");
  anchor.className = "relative inline-block align-baseline";
  anchor.style.width = "0";
  anchor.style.height = "1em";

  const chip = document.createElement("span");
  chip.setAttribute("data-testid", "ai-saw-it-chip-pill");
  chip.className = [
    "absolute -top-4 left-0 whitespace-nowrap",
    "inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5",
    "text-[9px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm",
  ].join(" ");

  // Inline SVG icons so we don't depend on the lucide-react runtime
  // inside a ProseMirror plugin (which renders DOM directly, not React).
  // Stroke uses `currentColor` so the icon picks up the chip's
  // `text-primary-foreground` automatically.
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.className = "inline-flex shrink-0 w-2.5 h-2.5";
  icon.innerHTML =
    entry.phase === "saw"
      ? // Check icon — confirmation that the cue made it onto the wire.
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : // Pencil icon — the AI is reading the just-committed edit.
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';

  const label = document.createElement("span");
  label.textContent = entry.phase === "saw" ? "AI saw this" : "AI is reading…";

  chip.appendChild(icon);
  chip.appendChild(label);
  anchor.appendChild(chip);
  wrapper.appendChild(anchor);
  return wrapper;
}

export const AiSawItDecoration = Extension.create({
  name: "aiSawItDecoration",

  addCommands() {
    return {
      showAiSawIt:
        (entry: { id?: number; pos: number; phase: AiSawItPhase }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            // Reserve an id up front when the caller didn't provide one
            // so the meta payload always carries a concrete identity —
            // simplifies the apply reducer below.
            const id = entry.id ?? allocateAiSawItId();
            tr.setMeta(META_SHOW, { id, pos: entry.pos, phase: entry.phase });
            dispatch(tr);
          }
          return true;
        },
      hideAiSawIt:
        (entry: { id: number }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(META_HIDE, { id: entry.id });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<AiSawItState>({
        key: aiSawItPluginKey,
        state: {
          init: () => INITIAL_STATE,
          apply(tr, prev): AiSawItState {
            // Re-map every chip's position through this transaction's
            // mapping so structural edits (AI diff, further typing) keep
            // each chip anchored at the right offset. ProseMirror's
            // `mapping` does the heavy lifting for any pos that survived
            // the change; positions inside replaced ranges are clamped
            // into the new doc bounds rather than dropped — the chip is
            // ephemeral and the React fade timer will evict it shortly
            // either way, so an approximate anchor is fine.
            const docSize = tr.doc.content.size;
            let entries = prev.entries;
            if (tr.docChanged && entries.length > 0) {
              entries = entries.map((e) => ({
                ...e,
                pos: clampPos(tr.mapping.map(e.pos), docSize),
              }));
            }

            const show = tr.getMeta(META_SHOW) as
              | { id: number; pos: number; phase: AiSawItPhase }
              | undefined;
            if (show) {
              const clamped = clampPos(show.pos, docSize);
              const idx = entries.findIndex((e) => e.id === show.id);
              if (idx === -1) {
                entries = [
                  ...entries,
                  { id: show.id, pos: clamped, phase: show.phase },
                ];
              } else {
                entries = entries.map((e, i) =>
                  i === idx ? { ...e, pos: clamped, phase: show.phase } : e,
                );
              }
            }

            const hide = tr.getMeta(META_HIDE) as
              | { id: number }
              | undefined;
            if (hide) {
              entries = entries.filter((e) => e.id !== hide.id);
            }

            if (entries === prev.entries) return prev;
            return { entries };
          },
        },
        props: {
          decorations(state) {
            const value = aiSawItPluginKey.getState(state);
            if (!value || value.entries.length === 0) {
              return DecorationSet.empty;
            }
            const docSize = state.doc.content.size;
            return DecorationSet.create(
              state.doc,
              value.entries.map((entry) =>
                Decoration.widget(
                  clampPos(entry.pos, docSize),
                  () => buildChipDom(entry),
                  {
                    // Side > 0 keeps the chip after the position so it
                    // floats above the character the user just typed,
                    // not above the preceding glyph.
                    side: 1,
                    // Stamp a key per (id, phase) so ProseMirror re-uses
                    // the widget DOM when only the phase changes — keeps
                    // the CSS opacity transition smooth across the
                    // reading → saw flip instead of remounting the node.
                    key: `ai-saw-it:${entry.id}:${entry.phase}`,
                  },
                ),
              ),
            );
          },
        },
      }),
    ];
  },
});
