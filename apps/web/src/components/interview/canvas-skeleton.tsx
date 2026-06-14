"use client";

/**
 * Animated skeleton block shown while the writer has scaffolded a new section
 * but has not yet streamed any heading, bullets, or paragraphs. Reserves the
 * vertical space so the layout doesn't jump when content arrives.
 *
 * Uses the standard Tailwind `animate-pulse` shimmer on `bg-muted`. The pulse
 * animation is automatically disabled under `prefers-reduced-motion` because
 * Tailwind's `animate-pulse` honours the media query.
 */
export function CanvasSkeleton() {
  return (
    <div
      role="status"
      aria-label="AI is preparing the next section"
      data-testid="canvas-skeleton"
      className="space-y-3 pb-5 border-b border-border last:border-0 last:pb-0"
    >
      <div className="h-5 w-1/3 bg-muted rounded motion-safe:animate-pulse" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted rounded motion-safe:animate-pulse" />
        <div className="h-3 w-11/12 bg-muted rounded motion-safe:animate-pulse" />
        <div className="h-3 w-3/4 bg-muted rounded motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
