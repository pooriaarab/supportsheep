"use client";

import * as React from "react";
import { Input } from "@repo/ui/primitives/input";
import { Search } from "lucide-react";
import { cn } from "@repo/ui/utils";

interface GlobalFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Global filter input for table-wide search.
 * Uses TanStack Table's global filtering feature.
 */
export function GlobalFilter({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: GlobalFilterProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 h-9"
        aria-label="Search table"
      />
    </div>
  );
}
