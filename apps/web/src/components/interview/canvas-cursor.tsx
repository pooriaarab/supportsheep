"use client";

import { Sparkles } from "lucide-react";

interface Props {
  /**
   * Whether the writer is actively producing content. When the writer goes
   * idle this flips to `false` and the caret fades out over ~600ms instead
   * of unmounting instantly so the transition feels like a collaborator
   * stepping away from the document rather than a hard cut.
   */
  isActive: boolean;
  /** Display name shown in the floating chip above the caret. Defaults to "AI". */
  label?: string;
  className?: string;
}

/**
 * Collaborative-editor style remote cursor for the AI writer. A bright
 * vertical bar blinks slowly via the `canvas-cursor-blink` keyframe; a
 * small "AI" chip floats above the caret showing who is editing. When
 * `isActive` flips to `false` the whole assembly fades out via CSS
 * `transition-opacity` (500ms) instead of disappearing instantly
 * (matches the 1500ms `WRITER_ACTIVE_TIMEOUT_MS` debounce upstream so the
 * cursor reads as "AI just stopped typing", not a stutter).
 *
 * Inspired by Figma/Liveblocks/Y.js remote cursors: one solid bar, one
 * name chip, accent-tinted so the user instantly sees "another editor is
 * here". Animations are gated behind `motion-safe:` so users with
 * `prefers-reduced-motion` see a static caret and chip.
 */
export function CanvasCursor({ isActive, label = "AI", className }: Props) {
  return (
    <span
      aria-hidden="true"
      data-testid="canvas-cursor"
      data-active={isActive ? "true" : "false"}
      className={[
        "pointer-events-none inline-flex flex-col items-start gap-0",
        "motion-safe:transition-opacity motion-safe:duration-500",
        isActive ? "opacity-100" : "opacity-0",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <span
        data-testid="canvas-cursor-chip"
        className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm"
      >
        <Sparkles className="size-2.5" aria-hidden="true" />
        <span>{label}</span>
      </span>
      <span
        data-testid="canvas-cursor-bar"
        className="mt-0.5 inline-block h-4 w-[2px] rounded-sm bg-primary motion-safe:[animation:canvas-cursor-blink_1s_ease-in-out_infinite]"
      />
    </span>
  );
}
