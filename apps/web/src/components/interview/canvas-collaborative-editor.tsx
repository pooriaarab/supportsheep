"use client";

/**
 * Canvas Collaborative Editor — the live interview body canvas as a single
 * full TipTap editor that mirrors the post editor at `/posts/[slug]/edit`.
 *
 * Renders the shared `RichTextEditorShell`, which is the same chrome the
 * article editor uses: toolbar, slash-command palette, figure alt menu,
 * centred prose column, focus ring. The canvas reuses that shell so the
 * in-call surface is character-identical to what the author sees post-
 * publish — no parallel renderer to drift.
 *
 * Bidirectional flow with the writer-worker (preserved unchanged from
 * W19.BC):
 *   - AI writes → SSE `writer_diff` events update `canvas` (prop) →
 *     `canvasToHtml(canvas)` is re-serialised and pushed into the editor
 *     ONLY when the human is not actively editing (recentHumanEditAtRef
 *     guard). This keeps the AI's source-of-truth diffs landing on the
 *     canvas without clobbering an in-flight keystroke.
 *   - Human types → `onUpdate` bumps `recentHumanEditAtRef` so the next
 *     incoming canvas snapshot is held back until the human pauses; the
 *     edit content stays local to the editor (server-side merge is
 *     handled separately by writer-worker via the existing
 *     canvas-edit / human-edit-merge path). Each debounced edit also
 *     produces a plain-English summary (`summarizeUserEdit`) that is
 *     forwarded to the realtime model via `onUserEdit`, so the AI can
 *     acknowledge and steer with whatever the user just wrote.
 *
 * AI cursor placement: the blinking remote-cursor is rendered as an
 * inline ProseMirror widget decoration via the `AiCursor` extension —
 * positioned at the natural edit point inside the document (end of the
 * last section the AI wrote to, falling back to end-of-doc) rather than
 * pinned to the top-right corner of the container. This matches the
 * Google-Docs / Liveblocks / Y.js collaboration-cursor convention so the
 * caret reads like a teammate's cursor sitting between the characters
 * the AI just produced. The shell's `overlay` slot retains a sr-only
 * fallback so SSR / pre-hydration markup still carries the
 * `canvas-cursor` hook for assistive tech detection.
 *
 * Editable-from-start: the TipTap editor mounts from the very first
 * paint, even when the canvas is empty. A soft TipTap Placeholder
 * invites the user to type or talk; anything they draft pre-AI is
 * preserved and visible to the realtime model through the existing
 * user-edit cue bridge, so the AI builds on top of their starting
 * point instead of overwriting it.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import {
  useCanvasEditorSync,
  type UserEditCueOptions,
} from "@/hooks/use-canvas-editor-sync";
import { useAiCursorPosition } from "@/hooks/use-ai-cursor-position";
import { useHumanCursorPosition } from "@/hooks/use-human-cursor-position";
import {
  AiCursor,
  AiReadingScanner,
  AiSawItDecoration,
  HumanCursor,
  allocateAiReadingScanId,
  allocateAiSawItId,
  getEditorExtensions,
  type SlashCommandState,
} from "@/lib/tiptap";
import { canvasToHtml } from "@/lib/interviews/canvas-to-html";
import { summarizeUserEditFromDoc } from "@/lib/interviews/user-edit-summary";
import type { JSONContent } from "@tiptap/core";
import { RichTextEditorShell } from "@/components/shared/rich-text-editor-shell";
import { CanvasCursor } from "./canvas-cursor";
import type {
  CanvasState,
  WriterActivity,
} from "@/hooks/use-interview-session";

interface Props {
  canvas: CanvasState;
  /**
   * Topic for the interview. Used as a fallback for the article title in
   * slash/figure menu context (AI image suggestions, link suggestions)
   * when the canvas doesn't yet have its own title.
   */
  topic?: string;
  /** Writer-worker activity signals — drives the "AI is editing" hint. */
  writerActivity?: WriterActivity;
  /**
   * Forwards a debounced summary of the human's most recent canvas
   * edit to the realtime model. Wired by the in-call layout to
   * `useInterviewSession`'s `sendUserEditCue`. When omitted, the
   * editor still works but the AI sees a silent canvas — only used in
   * tests or storybook stubs.
   */
  onUserEdit?: (summary: string) => boolean;
  /** Display name shown above the human's collaborative cursor. Optional —
   *  when absent the cursor still renders but the label falls back to "You". */
  guestName?: string;
}

/**
 * How long the inline "AI saw this" chip stays mounted before the React
 * layer dispatches `hideAiSawIt` to evict it. Long enough for a glance
 * to catch the acknowledgment, short enough that the chip doesn't
 * linger in the document once the conversation has moved on.
 *
 * Multiple bursts in different sections can coexist — each chip is
 * keyed by a unique id and tracked independently by the plugin, so
 * fades from one burst never wipe a sibling chip in another section.
 */
const AI_SAW_IT_FADE_MS = 2500;

/**
 * How long the reading-scanner highlight remains mounted before the
 * React layer clears it from the plugin. The CSS keyframe drives the
 * actual sweep in ~600ms and ends with `opacity: 0`, so we hold the
 * decoration slightly longer than the keyframe to absorb any rendering
 * jitter (slow paint, off-main-thread style recalc) before evicting.
 */
const AI_READING_SCAN_HOLD_MS = 800;

/**
 * How long the AI cursor stays snapped to the trailing edge of the
 * user's freshly-read range before reverting to its writer-tracked
 * base position. Long enough to read as a deliberate "I see this"
 * gesture (rather than a flicker) but short enough that an in-flight
 * writer-worker stream can resume its own caret motion quickly.
 */
const AI_CURSOR_PEEK_MS = 700;

export function CanvasCollaborativeEditor({
  canvas,
  topic,
  writerActivity,
  onUserEdit,
  guestName,
}: Props) {
  const isAppending = writerActivity?.isAppending ?? false;
  const lastWriteSectionId = writerActivity?.lastWriteSectionId ?? null;
  const hasAnyContent =
    canvas.title !== null || canvas.sections.length > 0;

  // Memoise the canvas-derived HTML by canvas reference. The editor only
  // re-reads this value when the human is idle (see the derived sync
  // block below). Computing it once per canvas ref keeps re-renders cheap.
  const articleHtml = useMemo(
    () => (hasAnyContent ? canvasToHtml(canvas) : ""),
    [canvas, hasAnyContent],
  );

  // Slash-command palette state — same shape the article editor uses, so
  // the shared shell can render the same `EditorSlashMenu` here.
  const [slashState, setSlashState] = useState<SlashCommandState>({
    active: false,
    query: "",
    slashPos: 0,
    coords: null,
  });

  // Cache the extension list per-mount so TipTap doesn't re-instantiate
  // every ProseMirror plugin on every parent render. The extensions are
  // pure with respect to props, so a single instantiation is correct.
  // `AiCursor` + `HumanCursor` are appended here so both remote-cursor
  // widget decorations live inside the same plugin stack as StarterKit /
  // Placeholder, sharing the same transaction lifecycle and re-mapping.
  //
  // Placeholder copy invites the user to start drafting immediately — the
  // canvas is editable from the moment the page loads, so the AI can
  // build on top of whatever the user has already typed instead of
  // overwriting them.
  const extensions = useMemo(
    () => [
      ...getEditorExtensions({
        placeholder:
          "Start talking or typing — I'll capture and structure your thoughts as you go.",
        slashCommands: { onStateChange: setSlashState },
      }),
      AiCursor,
      HumanCursor,
      // Inline locational confirmation that the AI received the user's
      // most-recent edit. The chip is rendered at the position the user
      // typed at — same Figma / Notion / Google Docs pattern the AI and
      // human cursors above use — rather than as a top-of-canvas
      // banner that fights for attention with the orb.
      AiSawItDecoration,
      // Yellow gradient that sweeps across the range of text the user
      // just typed at the moment the user_edit cue lands. Makes the
      // bidirectional canvas bridge feel tangible — the user sees the
      // AI "read" what they wrote rather than wondering whether their
      // edit was received.
      AiReadingScanner,
    ],
    [],
  );

  // Tracks the last time the human typed in this editor. Incoming
  // canvas snapshots are only pushed into the editor when this is
  // stale, so an in-flight keystroke isn't clobbered by an AI diff
  // that lands in the same render cycle. Owned here (not inside the
  // sync hook) so the editor's `onUpdate` closure can write to it.
  const recentHumanEditAtRef = useRef<number>(0);

  // Stabilise `editorProps` across renders. TipTap's `useEditor` shallow-
  // compares options on every render and calls `editor.setOptions(...)`
  // when any reference changes — and `setOptions` synchronously dispatches
  // a ProseMirror `updateState` transaction that fires every plugin's
  // `view.update` hook. Combined with any plugin that pushes into React
  // state from `view.update` (e.g. the slash-command palette publishing
  // its coords), an inline object literal here would feedback-loop with
  // the React re-render it triggers and exhaust the update-depth budget.
  const editorProps = useMemo(
    () => ({
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none py-4 min-h-[450px]",
        "data-testid": "canvas-collaborative-editor-content",
      },
    }),
    [],
  );

  // Tracks the document position of the user's most recent caret update
  // so the inline "AI saw this" chip anchors itself at the spot the
  // user just typed at, rather than at the doc end or a stale offset
  // from before the burst. Plain ref so updating it on every keystroke
  // doesn't trigger a re-render.
  const lastEditPosRef = useRef<number>(0);

  // Min/max ProseMirror positions touched during the current edit burst.
  // The reading-scanner uses this range to render its yellow sweep over
  // the EXACT span of text the user added between AI syncs. Reset back
  // to nulls after every successful cue dispatch so the next burst
  // produces a fresh range rather than accumulating one giant sweep that
  // covers everything since the editor mounted.
  const burstMinRef = useRef<number | null>(null);
  const burstMaxRef = useRef<number | null>(null);

  const handleUpdate = useCallback(
    ({
      editor: e,
    }: {
      editor: { state: { selection: { from: number; to: number } } };
    }) => {
      // Mark the human as actively editing so the canvas-sync hook holds
      // back the next AI diff until the user pauses.
      recentHumanEditAtRef.current = Date.now();
      // Expand the burst range to include the caret position after this
      // keystroke. Using `selection.from` (== `selection.to` for a
      // collapsed caret) captures the position immediately after the
      // newly-inserted character, which lines up with the trailing edge
      // of the user's added content for a forward typing burst. Deletions
      // are handled by the position-mapping pass below — the burst still
      // captures the user's working span around the edit.
      const sel = e.state.selection;
      const pos = sel.from;
      burstMinRef.current =
        burstMinRef.current === null
          ? pos
          : Math.min(burstMinRef.current, pos);
      burstMaxRef.current =
        burstMaxRef.current === null
          ? pos
          : Math.max(burstMaxRef.current, pos);
    },
    [],
  );

  const handleSelectionUpdate = useCallback(
    ({
      editor: e,
    }: {
      editor: { state: { selection: { from: number } } };
    }) => {
      // Keep the most recent caret position fresh so the chip that
      // confirms cue delivery anchors to where the user just typed.
      lastEditPosRef.current = e.state.selection.from;
    },
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
    extensions,
    content: articleHtml,
    editorProps,
    onUpdate: handleUpdate,
    onSelectionUpdate: handleSelectionUpdate,
  });

  // Compose the user-edit cue contract once per `onUserEdit` identity.
  // The sync hook depends on the object reference, so memoising here
  // keeps the user-edit listener from being torn down and re-attached
  // on every parent render — otherwise we'd leak `update` subscribers
  // across re-renders during a long interview.
  //
  // When the cue dispatcher returns `true` (the cue actually left the
  // local client onto the realtime data channel), drop an inline "AI
  // saw this" chip at the user's most recent caret position and
  // schedule it to fade out 2.5s later. This replaces the previous
  // top-of-canvas banner from W24.D with a LOCATIONAL hint that surfaces
  // collaborator activity right where the edit landed — mirroring how
  // Figma / Notion / Google Docs display remote-edit acknowledgments.
  const userEditCue = useMemo<UserEditCueOptions | undefined>(() => {
    if (!onUserEdit) return undefined;
    return {
      // Hand back the full ProseMirror doc JSON rather than just the
      // plain-text projection. Structural-only mutations (image insert,
      // code block, table, embed, callout, FAQ, HowTo, horizontal
      // rule, etc.) leave `getText()` unchanged but produce a doc-level
      // diff the summariser can describe by node type.
      readSnapshot: () => editor?.getJSON() ?? null,
      summarize: (before, after) =>
        summarizeUserEditFromDoc(
          before as JSONContent | null,
          after as JSONContent | null,
        )?.cueText ?? null,
      dispatch: (summary) => {
        const ok = onUserEdit(summary);
        if (ok && editor) {
          const docSize = editor.state.doc.content.size;
          const clamp = (p: number) => Math.max(0, Math.min(p, docSize));
          const chipPos = clamp(lastEditPosRef.current);

          const chipId = allocateAiSawItId();
          // Anchor the chip at the user's most recently observed caret
          // position, clamped into the current doc range so a follow-up
          // AI diff that landed between the keystroke and the debounce
          // window can't push it past the end of the doc.
          editor.commands.showAiSawIt({
            id: chipId,
            pos: chipPos,
            phase: "saw",
          });
          // The plugin holds the chip in the decoration set until we
          // dispatch `hideAiSawIt` for the same id. Each chip evicts on
          // its own timer so multiple bursts in different sections
          // coexist and fade independently — matching the spec for
          // locational collaborator activity.
          setTimeout(() => {
            editor.commands.hideAiSawIt({ id: chipId });
          }, AI_SAW_IT_FADE_MS);

          // Visible reading-scanner sweep: a yellow gradient slides
          // across the exact range the user added between the last AI
          // sync and this cue. Together with the chip above, the bridge
          // becomes tangible — the user sees the AI "read" their text
          // rather than only inferring it from a delayed spoken reply.
          const burstMin = burstMinRef.current;
          const burstMax = burstMaxRef.current;
          if (burstMin !== null && burstMax !== null && burstMax > burstMin) {
            const scanId = allocateAiReadingScanId();
            const from = clamp(burstMin);
            const to = clamp(burstMax);
            if (to > from) {
              editor.commands.triggerAiReadingScan({
                id: scanId,
                from,
                to,
              });
              setTimeout(() => {
                editor.commands.clearAiReadingScan({ id: scanId });
              }, AI_READING_SCAN_HOLD_MS);

              // Snap the AI's collaborator cursor to the trailing edge
              // of the user's freshly-read range for a beat, then let it
              // return to whatever the writer-worker is tracking. Signals
              // "I just read up to here" the same way a human collaborator
              // would move their caret onto your last word before
              // replying. The peek auto-clears via `pos: null` once the
              // sweep finishes its hold.
              editor.commands.peekAiCursor({ pos: to });
              setTimeout(() => {
                editor.commands.peekAiCursor({ pos: null });
              }, AI_CURSOR_PEEK_MS);
            }
          }
          // Reset the burst range so the next typing burst starts a
          // fresh sweep span instead of accumulating one giant range
          // since the editor mounted.
          burstMinRef.current = null;
          burstMaxRef.current = null;
        }
        return ok;
      },
    };
    // `editor` is captured by closure but its identity changes only on
    // mount/unmount (TipTap caches the instance), so excluding it keeps
    // the cue contract stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUserEdit]);

  // Bridge canvas snapshots → editor content. Held back while the
  // human is mid-edit so a keystroke isn't clobbered by an AI diff
  // that lands in the same render cycle.
  useCanvasEditorSync(editor, articleHtml, recentHumanEditAtRef, userEditCue);

  // Move the AI's inline cursor decoration to the natural edit position
  // inside the document — end of the section the writer-worker most
  // recently touched, or end of doc when no section info is available.
  // The CSS transition on the widget's `left` is provided by ProseMirror's
  // re-layout when the decoration position changes between transactions.
  useAiCursorPosition({
    editor,
    canvas,
    active: isAppending,
    lastWriteSectionId,
  });

  // Mirror the AI cursor on the human side: track `selection.from` so a
  // labelled caret floats above the user's cursor. Stays subtle while
  // the user is actively typing (they don't need their own name hovering
  // over their fingers) and fades to fully visible after a 2s idle pause
  // OR whenever the AI is co-editing — letting both cursors coexist
  // Figma-style. Label falls back to "You" when no guest name is known.
  const humanCursorLabel = guestName?.trim() || "You";
  useHumanCursorPosition({
    editor,
    label: humanCursorLabel,
    aiActive: isAppending,
  });

  // Derive an article-style title/excerpt for slash + figure menus so
  // AI-image suggestions stay relevant to the current interview canvas.
  const articleTitle = canvas.title ?? topic ?? undefined;
  const articleExcerpt = canvas.meta?.description ?? undefined;

  return (
    <div
      data-testid="canvas-collaborative-editor"
      className="relative flex-1 min-h-[550px] text-foreground bg-background rounded-lg border border-border shadow-sm overflow-hidden"
    >
      <RichTextEditorShell
        editor={editor}
        slashState={slashState}
        articleTitle={articleTitle}
        articleExcerpt={articleExcerpt}
        overlay={
          <>
            {/* Visually-hidden announcement preserves the "AI is editing" hook
                screen readers + downstream tests rely on. Mounts only while
                the writer is active so assistive tech stays quiet during idle. */}
            {isAppending ? (
              <span
                data-testid="canvas-collaborative-editor-editing-hint"
                aria-live="polite"
                className="sr-only"
              >
                AI is editing
              </span>
            ) : null}
            {/* SSR / pre-hydration fallback for the collaborator cursor. Once
                the TipTap editor mounts client-side, the inline widget
                decoration produced by the `AiCursor` extension takes over and
                renders the actual blinking caret at the AI's current edit
                position inside the document — the canonical Y.js / Liveblocks
                / TipTap collab-cursor pattern. This element exists only so
                server-rendered markup still carries the `canvas-cursor` hook
                for assistive tech detection during the brief
                hydration window. */}
            <span
              aria-hidden="true"
              data-testid="canvas-cursor-overlay"
              data-active={isAppending ? "true" : "false"}
              className="sr-only"
            >
              <CanvasCursor isActive={isAppending} label="AI" />
            </span>
          </>
        }
      />
    </div>
  );
}
