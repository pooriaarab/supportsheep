"use client";

import { X } from "lucide-react";
import { cn } from "../utils";

export interface FilterChip {
  id: string;
  label: string;
  condition?: string;
  value: string;
  onRemove: () => void;
  onClick?: () => void;
}

interface FilterChipsProps {
  chips: FilterChip[];
  className?: string;
}

export function FilterChips({ chips, className }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {chips.map((chip) => (
        <div
          key={chip.id}
          className="inline-flex items-center h-6 rounded-md border bg-background text-xs"
        >
          <button
            type="button"
            onClick={chip.onClick}
            disabled={!chip.onClick}
            className={cn(
              "inline-flex items-center h-full rounded-l-md",
              chip.onClick
                ? "hover:bg-accent cursor-pointer transition-colors"
                : "cursor-default",
            )}
          >
            <span className="px-2 text-muted-foreground">{chip.label}</span>
            <span className="px-2 border-x text-muted-foreground">
              {chip.condition ?? "is"}
            </span>
            <span className="px-2 font-medium">{chip.value}</span>
          </button>
          <button
            type="button"
            onClick={chip.onRemove}
            className="w-6 h-full flex items-center justify-center border-l hover:bg-accent rounded-r-md transition-colors"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
