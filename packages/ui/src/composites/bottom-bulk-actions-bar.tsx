"use client";

import * as React from "react";
import { Command, X } from "lucide-react";
import { cn } from "../utils";

const transformOriginStyle = { transformOrigin: "bottom center" } as const;

export interface BottomBulkActionsBarProps {
  count: number;
  onClear: () => void;
  onActionsClick: () => void;
  itemNameSingular?: string;
  itemNamePlural?: string;
  className?: string;
}

function SelectionSection({
  count,
  onClear,
  itemNameSingular,
  itemNamePlural,
}: {
  count: number;
  onClear: () => void;
  itemNameSingular: string;
  itemNamePlural: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 min-h-[40px] flex-1 sm:flex-initial">
      <button
        type="button"
        onClick={onClear}
        className="text-sm font-medium leading-none hover:text-foreground/80 transition-colors cursor-pointer"
      >
        <span className="font-semibold">{count}</span>
        &nbsp;
        <span className="hidden sm:inline">
          {count === 1 ? itemNameSingular : itemNamePlural}
        </span>
        <span className="inline sm:hidden">selected</span>
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selected"
        className="size-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function BottomBulkActionsBar({
  count,
  onClear,
  onActionsClick,
  itemNameSingular = "item",
  itemNamePlural = "items",
  className,
}: BottomBulkActionsBarProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    }
    setIsVisible(false);
  }, [count]);

  if (count === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[100] flex items-center justify-center pb-6 px-4 transition-[transform,opacity] duration-200 ease-in-out md:pb-4",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none",
        className,
      )}
      style={transformOriginStyle}
    >
      <div className="inline-flex items-center gap-0 bg-background rounded-lg border border-border shadow-lg w-full max-w-[400px] sm:w-auto sm:max-w-none">
        <SelectionSection
          count={count}
          onClear={onClear}
          itemNameSingular={itemNameSingular}
          itemNamePlural={itemNamePlural}
        />
        <div className="h-[22px] w-px bg-border" />
        <div className="flex items-center px-3 py-2">
          <button
            type="button"
            onClick={onActionsClick}
            aria-label="Open command menu"
            className="flex items-center gap-2 text-sm font-medium hover:text-foreground/80 transition-colors"
          >
            <Command className="size-4" aria-hidden="true" />
            <span>Actions</span>
          </button>
        </div>
      </div>
    </div>
  );
}
