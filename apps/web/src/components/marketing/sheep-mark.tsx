/**
 * The Supportsheep logo as an inline SVG.
 *
 * Mirrors the single shared path from `public/logo.svg` but inlined so it can be
 * sized freely and inherit `currentColor`.
 */

interface SheepMarkProps {
  className?: string;
  title?: string;
}

export function SheepMark({ className, title }: SheepMarkProps) {
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
      <path d="M42 20 C42 12, 34 8, 28 14 C24 10, 16 12, 16 20 C10 22, 10 32, 16 34 C18 42, 28 44, 32 38 C36 44, 46 42, 46 34 C52 32, 52 22, 46 20 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <rect x="40" y="24" width="12" height="10" rx="4" fill="currentColor" opacity="0.8"/>
      <rect x="22" y="42" width="4" height="10" rx="2" fill="currentColor"/>
      <rect x="38" y="42" width="4" height="10" rx="2" fill="currentColor"/>
    </svg>
  );
}
