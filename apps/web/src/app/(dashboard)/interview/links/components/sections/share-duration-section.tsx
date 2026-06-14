"use client";

import React from "react";
import { Badge } from "@repo/ui/primitives/badge";

interface ShareDurationSectionProps {
  value: number; // in seconds
  onChange: (value: number) => void;
}

export function ShareDurationSection({ value, onChange }: ShareDurationSectionProps) {
  const minutes = Math.max(1, Math.min(30, Math.round(value / 60)));

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">Duration</h3>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="1"
          max="30"
          value={minutes}
          onChange={(e) => onChange(Number(e.target.value) * 60)}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
        />
        <Badge variant="outline" className="min-w-[72px] justify-center text-xs font-semibold py-1">
          {minutes} min
        </Badge>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">
        Default 5 min. Max 30 min. At 90%, the AI will signal you have one more topic to cover.
      </div>
    </div>
  );
}
