"use client";

/**
 * Interview Canvas — the live body editor for the in-call layout. After
 * the W19b/c refactor the body IS the canvas: no Body/Image/SEO/EEAT
 * tabbed wrapper, just a single full TipTap editor backed by the same
 * extension stack as the post editor at `/[postId]/edit`. SEO / Image /
 * EEAT now live in the right sidebar (`CanvasRightSidebar`).
 *
 * The wrapper still exists as a tiny composition layer so the skeleton
 * placeholder for an in-flight section can sit beneath the editor
 * without the editor having to reason about orb state. AI activity is
 * communicated through the orb itself, so there is no separate thinking
 * indicator under the body.
 */

import { CanvasCollaborativeEditor } from "./canvas-collaborative-editor";
import { CanvasTypingSound } from "./canvas-typing-sound";
import type {
  CanvasState,
  WriterActivity,
} from "@/hooks/use-interview-session";

interface Props {
  canvas: CanvasState;
  topic?: string;
  writerActivity?: WriterActivity;
  /** Forwarded to the editor to label the human collaborative cursor. */
  guestName?: string;
  className?: string;
  /**
   * Forwards the human's debounced canvas edits to the realtime model so
   * the AI can acknowledge and react to them. Wired by the layout to
   * `useInterviewSession#sendUserEditCue`; undefined in tests where the
   * realtime client isn't booted.
   */
  onUserEdit?: (summary: string) => boolean;
}

export function InterviewCanvas({
  canvas,
  topic,
  writerActivity,
  guestName,
  className,
  onUserEdit,
}: Props) {
  const isAppending = writerActivity?.isAppending ?? false;
  const hasEmptyTrailingSection =
    writerActivity?.hasEmptyTrailingSection ?? false;
  const hasAnyContent =
    canvas.title !== null || canvas.sections.length > 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-end mb-2">
        <CanvasTypingSound isAppending={isAppending} />
      </div>

      <CanvasCollaborativeEditor
        canvas={canvas}
        topic={topic}
        writerActivity={writerActivity}
        onUserEdit={onUserEdit}
        guestName={guestName}
      />

      {/* Mid-section signals rendered outside the editor so they sit beneath
          the rich-text doc rather than fighting the editor's own DOM. */}
      {hasAnyContent && hasEmptyTrailingSection && (
        <div
          role="status"
          aria-label="AI is preparing the next section"
          data-testid="canvas-skeleton"
          className="space-y-3 px-5 pb-3 mt-3"
        >
          <div className="h-5 w-1/3 bg-muted rounded motion-safe:animate-pulse" />
          <div className="h-3 w-full bg-muted rounded motion-safe:animate-pulse" />
          <div className="h-3 w-11/12 bg-muted rounded motion-safe:animate-pulse" />
        </div>
      )}
    </div>
  );
}
