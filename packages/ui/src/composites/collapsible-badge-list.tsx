"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { cn } from "../utils";

interface CollapsibleBadgeListProps {
  children: ReactNode;
  /** Maximum visible rows before collapsing. Default: 2 */
  maxRows?: number;
  /** CSS class for the container */
  className?: string;
  /** Total number of items (used for "+N more" count when collapsed) */
  totalCount: number;
}

export function CollapsibleBadgeList({
  children,
  maxRows = 2,
  className,
  totalCount,
}: CollapsibleBadgeListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | undefined>(
    undefined
  );

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const firstChild = el.firstElementChild as HTMLElement | null;
    if (!firstChild) return;

    const rowHeight = firstChild.offsetHeight;
    const gap = parseFloat(getComputedStyle(el).rowGap) || 4;
    const maxHeight = rowHeight * maxRows + gap * (maxRows - 1);
    const overflows = el.scrollHeight > maxHeight + rowHeight * 0.5;

    setIsOverflowing(overflows);
    setCollapsedHeight(maxHeight);
  }, [maxRows]);

  // ResizeObserver fires only when container dimensions actually change,
  // avoiding re-measurement on every render (children is a new ref each time).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className={cn(
          "flex flex-wrap gap-1 overflow-hidden transition-[max-height] duration-200",
          className
        )}
        style={
          !expanded && isOverflowing && collapsedHeight
            ? { maxHeight: collapsedHeight }
            : undefined
        }
      >
        {children}
      </div>

      {isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show less" : `+${totalCount} total — show all`}
        </button>
      )}
    </div>
  );
}
