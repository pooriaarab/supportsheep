import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Editor } from "@tiptap/react";
import {
  computeTypewriterPlan,
  scheduleTypewriter,
  type TypewriterTimer,
} from "@/lib/interviews/typewriter-stream";

/**
 * Resolve the ProseMirror position that lands INSIDE the doc's last
 * top-level block, at the trailing edge of its content. Used to anchor
 * the AI cursor between the freshly-typed character and the closing tag
 * of the paragraph being streamed — without the `-1` adjustment the
 * cursor sits at `doc.content.size`, which is the position BETWEEN
 * blocks at root level (i.e. visually below the new paragraph), so the
 * caret reads as "pinned at the bottom" instead of advancing with each
 * typed character.
 *
 * Returns `0` for an empty doc and falls back to `docEnd` when the doc's
 * last child isn't a block (defensive — TipTap doesn't put text at root
 * but a misconfigured schema shouldn't crash the cursor).
 */
function endOfLastBlockPos(editor: Editor): number {
  const doc = editor.state.doc;
  const docEnd = doc.content.size;
  if (doc.content.childCount === 0) return 0;
  const lastChild = doc.content.child(doc.content.childCount - 1);
  if (!lastChild.isBlock) return docEnd;
  return Math.max(0, docEnd - 1);
}

/**
 * Quiet window after a human keystroke during which incoming canvas
 * snapshots are held back so an in-flight edit isn't overwritten. Keeps
 * the editor responsive — long enough to span a normal typing burst,
 * short enough that an idle pause lets the AI's diff land within a beat.
 */
const HUMAN_EDIT_QUIET_MS = 2000;

/**
 * Debounce window for emitting a `user_edit` narration cue after the
 * human stops typing. Shorter than the AI-sync quiet window so the cue
 * fires before the next AI diff can land and erase the user's burst —
 * but long enough that a single fast typing burst produces ONE cue,
 * not one per keystroke.
 */
const USER_EDIT_CUE_DEBOUNCE_MS = 400;

/**
 * Callback the canvas editor uses to forward a debounced user-edit
 * summary to the realtime model. Returns `true` when the cue was
 * accepted (forwarded to the data channel) and `false` when the hook
 * dropped it as a duplicate or before-mount.
 */
export type UserEditCueDispatcher = (summary: string) => boolean;

/**
 * Build a structured snapshot of a user edit and hand it back so the
 * caller can convert it into a narration cue. Pure so it can be
 * unit-tested without booting TipTap.
 *
 * The cue contract carries an opaque `Snapshot` blob the caller
 * supplies (typically `editor.getJSON()`) so the diff sees the full
 * ProseMirror document structure, not just its plain-text projection.
 * This keeps structural-only edits (images, code blocks, tables,
 * embeds, callouts, etc.) from collapsing to an empty text diff —
 * the W25.A bug where every non-text mutation produced a silent or
 * empty-bodied user-edit cue.
 */
export type UserEditSnapshot = unknown;

export interface UserEditCueOptions {
  /**
   * Reads the editor's current structural snapshot. Called at the end
   * of the debounce window so the snapshot reflects everything the
   * user typed in the burst, not just the first keystroke.
   */
  readonly readSnapshot: () => UserEditSnapshot;
  /**
   * Hands a one-line summary of the diff (before → after) back to the
   * caller. Returning `null` here means "nothing changed, skip the cue".
   */
  readonly summarize: (
    before: UserEditSnapshot,
    after: UserEditSnapshot,
  ) => string | null;
  /**
   * Forwards the summary to the realtime model. Typically wired to the
   * hook's `sendUserEditCue`.
   */
  readonly dispatch: UserEditCueDispatcher;
}

/**
 * Sync a TipTap editor's content from an externally-supplied HTML
 * snapshot (e.g. the canvas state arriving as `writer_diff` SSE events)
 * while preserving in-flight human keystrokes, and emit a `user_edit`
 * narration cue at the end of every human-edit quiet window so the AI
 * can see and react to what the user typed.
 *
 * Behaviour:
 *   - On every `articleHtml` change, evaluate whether to sync — only
 *     run if the human is idle (last keystroke older than
 *     `HUMAN_EDIT_QUIET_MS`) or the editor was empty.
 *   - The caller bumps `recentHumanEditAtRef.current = Date.now()`
 *     from the editor's `onUpdate` handler to mark active typing —
 *     the ref is owned by the caller so its `useEditor` closure can
 *     write to the same instance the hook reads from.
 *   - When the canvas snapshot extends the previous one with a single
 *     trailing paragraph, the new text is revealed character-by-
 *     character via the typewriter stream so the AI's words land like
 *     keystrokes rather than dumping all at once. Structural changes
 *     (lists, images, code, headings, edits to existing paragraphs)
 *     and the initial hydration always snap-apply.
 *   - Every `setContent` call uses `emitUpdate: false` so neither the
 *     snap-apply nor the typewriter intermediates re-trigger the human-
 *     edit suppression OR the user-edit cue debounce.
 *
 * When `userEditCue` is provided the hook also tracks the last
 * AI-synced plain-text snapshot. After every human edit burst, it
 * debounces by `USER_EDIT_CUE_DEBOUNCE_MS` and then asks the caller
 * to summarize before-vs-after and dispatch the cue — so the AI
 * interviewer sees the user's edit as part of the conversation
 * rather than discovering it the next time it rewrites the canvas.
 *
 * Direct `useEffect` is banned in components project-wide, so this
 * wrapper hook is the single sanctioned place to use it for the
 * canvas → editor sync — mirrors the `useMountEffect` pattern.
 */
export function useCanvasEditorSync(
  editor: Editor | null,
  articleHtml: string,
  recentHumanEditAtRef: MutableRefObject<number>,
  userEditCue?: UserEditCueOptions,
): void {
  const lastSyncedHtmlRef = useRef<string>("");
  // Tracks the structural snapshot of the canvas the last time the AI
  // pushed a diff into the editor. Reset to the freshly-applied content
  // whenever an AI sync lands. Used as the baseline for the user-edit
  // cue diff ONLY for the very first cue after an AI write — after a
  // cue has been dispatched, subsequent cues diff against
  // `lastCueSnapshotRef` instead, so a long typing burst broken across
  // multiple debounce windows reports the *new* edit each time rather
  // than re-quoting everything since the last AI sync.
  const lastAiSyncedSnapshotRef = useRef<UserEditSnapshot>(null);
  // Tracks the structural snapshot at the moment the previous user-edit
  // cue was dispatched. Decoupled from `lastAiSyncedSnapshotRef` so an
  // AI sync that lands between the user's keystrokes (e.g. SSE echoing
  // the user's own edit back from the writer-worker) can refresh the
  // AI-synced baseline without erasing the cue dispatcher's notion of
  // "what we've already told the AI about". `null` means "no cue
  // dispatched yet this session" — the first cue diffs against
  // `lastAiSyncedSnapshotRef`, after which this ref takes over.
  const lastCueSnapshotRef = useRef<UserEditSnapshot | null>(null);
  // The debounce timer for the user-edit cue. Reset on every keystroke
  // so a steady burst produces one cue at the end, not one per key.
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Handle to cancel any in-flight typewriter animation when a new
  // target snapshot supersedes it, the human starts editing, or the
  // hook unmounts.
  const cancelTypewriterRef = useRef<(() => void) | null>(null);

  // Direct useEffect is sanctioned inside dedicated wrapper hooks (same
  // pattern as `useMountEffect`); a deps-tracked sync is the correct
  // primitive for mirroring an external snapshot into a TipTap editor.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!editor) return;
    if (articleHtml === lastSyncedHtmlRef.current) return;

    const sinceHumanEdit = Date.now() - recentHumanEditAtRef.current;
    const humanIsIdle = sinceHumanEdit > HUMAN_EDIT_QUIET_MS;
    const editorWasEmpty = lastSyncedHtmlRef.current === "";

    if (!humanIsIdle && !editorWasEmpty) {
      // Hold back this snapshot — the human is mid-edit. Cancel any
      // in-flight typewriter so the human's keystroke isn't fighting
      // an animated insert from a stale diff.
      if (cancelTypewriterRef.current) {
        cancelTypewriterRef.current();
        cancelTypewriterRef.current = null;
      }
      return;
    }

    // Cancel any in-flight typewriter — the new target supersedes it.
    if (cancelTypewriterRef.current) {
      cancelTypewriterRef.current();
      cancelTypewriterRef.current = null;
    }

    const plan = editorWasEmpty
      ? ({ kind: "snap" } as const)
      : computeTypewriterPlan(lastSyncedHtmlRef.current, articleHtml);

    // Snapshot the *target* HTML as the new baseline regardless of which
    // branch we take. Setting it to the target (not the intermediate)
    // keeps the typewriter idempotent — if the same snapshot lands
    // twice (SSE replay) the second sync sees no delta and bails.
    lastSyncedHtmlRef.current = articleHtml;

    if (plan.kind === "snap") {
      editor.commands.setContent(articleHtml || "", { emitUpdate: false });
      // Refresh the AI-synced text snapshot so the next user-edit cue
      // describes the diff relative to what the AI just wrote, not to
      // some older state. `getText()` returns the editor's plain text
      // (no HTML tags) which is what the diff summary works against.
      // The cue snapshot is intentionally NOT touched here — that
      // baseline tracks what we last narrated to the AI, which is
      // orthogonal to what the AI itself wrote. Conflating them is the
      // W24.I race where an SSE-driven AI sync mid-burst would absorb
      // the user's text and make the next cue diff to empty.
      if (userEditCue) {
        lastAiSyncedSnapshotRef.current = userEditCue.readSnapshot();
      }
      return;
    }

    // Render the empty paragraph scaffold up front so the cursor lands
    // inside the new <p> on the very first paint, then animate the
    // inner text in.
    editor.commands.setContent(
      plan.prefix + plan.paragraphOpen + plan.paragraphClose,
      { emitUpdate: false },
    );

    cancelTypewriterRef.current = scheduleTypewriter(
      plan,
      {
        onIntermediate: (html) => {
          editor.commands.setContent(html, { emitUpdate: false });
          // Anchor the AI cursor INSIDE the last paragraph at the
          // trailing edge of the freshly-revealed text, not at the
          // root-level position after the closing </p>. Using
          // `doc.content.size` parks the widget BETWEEN blocks — which
          // renders below the new paragraph and produces the "cursor
          // pinned at the bottom while text grows above it" artefact.
          // `endOfLastBlockPos` returns `docEnd - 1` so the widget sits
          // right after the most-recent character, leading the next
          // tick's insertion the way a real typewriter caret would.
          const pos = endOfLastBlockPos(editor);
          editor.commands.setAiCursor({ pos, active: true, label: "AI" });
        },
        onComplete: () => {
          // Final paint must equal the target — `articleHtml` is the
          // canonical render of the canvas; the assembled intermediate
          // above already equals it, but we re-set defensively in case
          // the canvas converter ever produces a slightly different
          // serialisation (whitespace, attribute order).
          editor.commands.setContent(articleHtml, { emitUpdate: false });
          // Pin the cursor INSIDE the now-complete final paragraph; the
          // next canvas-derived `useAiCursorPosition` run will refine
          // it to the section-end position if the writer keeps going.
          const pos = endOfLastBlockPos(editor);
          editor.commands.setAiCursor({ pos, active: true, label: "AI" });
          // Refresh the AI-synced text baseline so a subsequent user
          // edit's cue diffs against everything the AI just typed,
          // not against the state from before this stream started.
          // Leave `lastCueSnapshotRef` alone — see the snap branch
          // above for why those baselines stay decoupled.
          if (userEditCue) {
            lastAiSyncedSnapshotRef.current = userEditCue.readSnapshot();
          }
          cancelTypewriterRef.current = null;
        },
      },
      { timer: realTimer },
    );

    // Cleanup: cancel the in-flight typewriter on rerun/unmount so a
    // stale callback never paints into a torn-down editor.
    return () => {
      if (cancelTypewriterRef.current) {
        cancelTypewriterRef.current();
        cancelTypewriterRef.current = null;
      }
    };
  }, [editor, articleHtml, recentHumanEditAtRef, userEditCue]);

  // Cancel any in-flight AI typewriter the instant the human types.
  //
  // W24.C: pressing Enter / typing anything while the AI typewriter is
  // mid-stream produced "Enter doesn't work" — the next typewriter tick
  // would call `editor.commands.setContent(intermediate, ...)` on the
  // 25-55ms cadence and clobber the user's keystroke (Enter included),
  // because the typewriter only cancels when a NEW `articleHtml` arrives,
  // and a human keystroke alone doesn't change the prop. Subscribing to
  // the editor's `update` event here gives every human keystroke an
  // immediate "stop the typewriter" hook regardless of canvas-prop
  // movement. The AI's own `setContent` is dispatched with
  // `emitUpdate: false`, so the only updates we observe are human ones.
  //
  // Direct useEffect is sanctioned inside dedicated wrapper hooks (same
  // pattern as `useMountEffect`); a deps-tracked subscription is the
  // correct primitive for an editor lifetime listener.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!editor) return;
    const onHumanType = () => {
      if (cancelTypewriterRef.current) {
        cancelTypewriterRef.current();
        cancelTypewriterRef.current = null;
      }
    };
    editor.on("update", onHumanType);
    return () => {
      editor.off("update", onHumanType);
    };
  }, [editor]);

  // Schedule a debounced user-edit cue whenever the human typing
  // timestamp moves. The effect re-runs on every `recentHumanEditAtRef`
  // mutation because the caller passes the SAME ref but bumps the
  // value — React doesn't track that, so we read the value into a
  // tracked dep at the component boundary. We do that by reading the
  // current ref value on every render via a small wrapper effect.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!editor || !userEditCue) return;
    // Subscribe to the editor's own update stream — the ref-mutation
    // from `onUpdate` won't re-run this effect, but TipTap's `update`
    // event will, so we listen directly. Returning the cleanup
    // detaches the listener on unmount or editor swap.
    const onUpdate = () => {
      // The AI's own `setContent` is invoked with `emitUpdate: false`,
      // so any `update` we observe here is a human keystroke. Reset
      // the debounce timer; the cue fires once the user stops typing
      // for `USER_EDIT_CUE_DEBOUNCE_MS`.
      if (cueTimerRef.current !== null) clearTimeout(cueTimerRef.current);
      cueTimerRef.current = setTimeout(() => {
        cueTimerRef.current = null;
        const after = userEditCue.readSnapshot();
        // Diff against the previous cue's snapshot when one exists,
        // otherwise fall back to the last AI-synced structural snapshot.
        // This decoupling is what makes the cue report exactly what the
        // user has changed since we last narrated to the AI — even if
        // an SSE-driven AI sync silently refreshed
        // `lastAiSyncedSnapshotRef` mid-burst to include the user's
        // own text (writer-worker reflects user edits back through the
        // canvas stream, so without this split the diff would compute
        // to an empty tail and the AI would see `[system narration
        // cue] The user just added new text to the canvas: ""`,
        // W24.I).
        const before =
          lastCueSnapshotRef.current ?? lastAiSyncedSnapshotRef.current;
        const summary = userEditCue.summarize(before, after);
        if (!summary) return;
        const ok = userEditCue.dispatch(summary);
        if (ok) {
          // Slide the cue baseline (not the AI baseline) forward so the
          // next burst diffs against the user's now-current snapshot
          // rather than re-reporting the same edit again. Leaving
          // `lastAiSyncedSnapshotRef` alone keeps the AI-sync side of
          // the hook a single owner of its own state.
          lastCueSnapshotRef.current = after;
        }
      }, USER_EDIT_CUE_DEBOUNCE_MS);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      if (cueTimerRef.current !== null) {
        clearTimeout(cueTimerRef.current);
        cueTimerRef.current = null;
      }
    };
  }, [editor, userEditCue]);
}

const realTimer: TypewriterTimer = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};
