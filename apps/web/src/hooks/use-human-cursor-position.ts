import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Idle window after the last keystroke before the human's cursor flips
 * from "subtle" to "prominent" (chip fully visible). Picked to feel like
 * the user briefly pausing to think — short enough that the cursor
 * surfaces quickly when they reach for it, long enough that it doesn't
 * flash on every typing micro-pause.
 */
const IDLE_PROMINENCE_DELAY_MS = 2000;

/**
 * Polling cadence used to detect the idle→prominent transition. Cheap —
 * the loop just compares two timestamps; no React re-renders unless the
 * prominence flag actually changes.
 */
const IDLE_POLL_INTERVAL_MS = 250;

interface UseHumanCursorPositionArgs {
  editor: Editor | null;
  /** Display label shown in the chip above the human's caret. */
  label: string;
  /** True while the AI writer-worker is appending. The human cursor stays
   *  prominent the whole time the AI is editing so the user can see both
   *  carets side-by-side (Figma-style multi-collaborator view). */
  aiActive: boolean;
}

/**
 * Keep the `HumanCursor` ProseMirror plugin's decoration aligned with
 * the human's caret position, and drive its `prominent` and `visible`
 * flags based on the focus + idle + AI-active policy:
 *
 *   - Editor blurred / never focused → `visible: false` (widget fades out,
 *     native caret restored; only the green cursor disappears when the
 *     user clicks somewhere outside the document).
 *   - Editor focused + during active typing → `visible: true`,
 *     `prominent: false` (subtle bar, hidden chip).
 *   - Editor focused + >2s since last keystroke → `prominent: true`
 *     (chip fades in).
 *   - Editor focused + AI writer-worker active → `prominent: true`
 *     regardless of idle state, so both collaborator cursors are
 *     visible together (Figma-style multi-collaborator view).
 *
 * The fade-in/out is driven by the widget's CSS opacity transition, not
 * by mount/unmount, so toggling `visible` produces a 200ms ease-out
 * crossfade instead of a hard pop.
 *
 * Direct `useEffect` is banned project-wide via ESLint; this is a
 * dedicated sync wrapper hook (same exemption pattern as
 * `useAiCursorPosition`). All listeners are registered once per editor
 * instance and torn down on unmount.
 */
export function useHumanCursorPosition({
  editor,
  label,
  aiActive,
}: UseHumanCursorPositionArgs): void {
  // Tracks the last time the user produced a keystroke or moved the
  // selection. Plain ref so the typing handler doesn't trigger a React
  // re-render on every key.
  const lastActivityAtRef = useRef<number>(0);
  // The latest prominence we pushed into the plugin, so the idle poll
  // can short-circuit when nothing has changed.
  const lastProminentRef = useRef<boolean>(false);
  // The latest visibility we pushed into the plugin, mirrored here so
  // the idle poll can early-out when nothing has changed.
  const lastVisibleRef = useRef<boolean>(false);

  // eslint-disable-next-line no-restricted-syntax -- dedicated sync wrapper hook
  useEffect(() => {
    if (!editor) return;

    const pushCursor = (prominent: boolean, visible: boolean) => {
      const pos = editor.state.selection.from;
      editor.commands.setHumanCursor({ pos, prominent, label, visible });
      lastProminentRef.current = prominent;
      lastVisibleRef.current = visible;
    };

    // Compute prominence right now: AI active wins, otherwise check
    // whether enough idle time has passed since the last keystroke.
    const computeProminent = (): boolean => {
      if (aiActive) return true;
      const idleFor = Date.now() - lastActivityAtRef.current;
      return idleFor >= IDLE_PROMINENCE_DELAY_MS;
    };

    // Cursor is only visible when the editor itself is focused. Clicking
    // outside the document (toolbar, sidebar, page chrome) hides the
    // labelled cursor so it doesn't linger on screen as a false signal
    // that the user is in the document.
    const computeVisible = (): boolean => editor.isFocused;

    const handleSelectionUpdate = () => {
      // Selection changes are NOT treated as "typing" — a click or arrow
      // key to navigate shouldn't dim the cursor. Only `update` events
      // (content changes) bump the activity timestamp.
      pushCursor(computeProminent(), computeVisible());
    };

    const handleUpdate = () => {
      lastActivityAtRef.current = Date.now();
      // A keystroke flips the cursor back to subtle (false) immediately
      // unless the AI is co-editing.
      pushCursor(aiActive, computeVisible());
    };

    const handleFocus = () => {
      pushCursor(computeProminent(), true);
    };

    const handleBlur = () => {
      // Keep `pos` at the user's last caret offset so the widget stays
      // mounted and fades out smoothly via the CSS opacity transition,
      // rather than unmounting and snapping away.
      pushCursor(computeProminent(), false);
    };

    // Push an initial cursor placement so the decoration appears even
    // before the user moves the caret — gated by current focus state.
    pushCursor(computeProminent(), computeVisible());

    editor.on("selectionUpdate", handleSelectionUpdate);
    editor.on("update", handleUpdate);
    editor.on("focus", handleFocus);
    editor.on("blur", handleBlur);

    // Idle poll — flips to prominent once IDLE_PROMINENCE_DELAY_MS has
    // elapsed since the last keystroke. Avoids a debounce timer that
    // would need clearing on every keystroke. Also re-syncs `visible`
    // in case focus state changed without a TipTap event firing (rare,
    // but a safety net so the cursor never lingers on a blurred editor).
    const pollId = window.setInterval(() => {
      const nextProminent = computeProminent();
      const nextVisible = computeVisible();
      if (
        nextProminent !== lastProminentRef.current ||
        nextVisible !== lastVisibleRef.current
      ) {
        pushCursor(nextProminent, nextVisible);
      }
    }, IDLE_POLL_INTERVAL_MS);

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
      editor.off("update", handleUpdate);
      editor.off("focus", handleFocus);
      editor.off("blur", handleBlur);
      window.clearInterval(pollId);
    };
  }, [editor, label, aiActive]);
}
