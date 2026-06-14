/**
 * The Supportsheep bat silhouette as an inline SVG.
 *
 * Mirrors the single shared path from `public/logo.svg` but inlined so it can be
 * sized freely and inherit `currentColor` (the public SVG is consumed via
 * `next/image` elsewhere, which strips color context). Decorative by default;
 * pass a `title` to expose an accessible label.
 */

interface BatMarkProps {
  className?: string;
  title?: string;
}

/**
 * The single shared bat silhouette path (mirrors `public/logo.svg`). Exported so
 * other marketing visuals (e.g. the animated hero bat) reuse the exact geometry
 * rather than redrawing it — see DESIGN.md ("a single path; do not redraw").
 */
export const BAT_PATH_D =
  "M32 22C30.5 19 29 17 27 16C27.5 18 27.5 19.5 27 21C24.5 19.5 21 19 18 20.5C15 22 13 25 12.5 28.5C11 27 9 26.5 7 26.5C8 28.5 8.5 30.5 8 32.5C11 31.5 14 32 16.5 34C18 35.2 19.5 34.5 20 33C21 35.5 23 37 25.5 37.5C26 36 27 35 28.5 35C30 35 31.2 36 32 37.5C32.8 36 34 35 35.5 35C37 35 38 36 38.5 37.5C41 37 43 35.5 44 33C44.5 34.5 46 35.2 47.5 34C50 32 53 31.5 56 32.5C55.5 30.5 56 28.5 57 26.5C55 26.5 53 27 51.5 28.5C51 25 49 22 46 20.5C43 19 39.5 19.5 37 21C36.5 19.5 36.5 18 37 16C35 17 33.5 19 32 22Z";

export function BatMark({ className, title }: BatMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d={BAT_PATH_D} />
    </svg>
  );
}
