"use client";

import { cn } from "@repo/ui/utils";

interface TableToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function TableToolbar({ left, right, className }: TableToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-4 sm:px-6 py-2 border-b bg-background",
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">{left}</div>
      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
        {right}
      </div>
    </div>
  );
}
