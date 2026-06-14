"use client";

import React from "react";
import type { AuthMode } from "@/lib/interviews/share-link-schema";
import { cn } from "@/lib/utils";

interface ShareAuthSectionProps {
  value: AuthMode;
  onChange: (value: AuthMode) => void;
}

export function ShareAuthSection({ value, onChange }: ShareAuthSectionProps) {
  const options = [
    { id: "anonymous" as const, label: "Anonymous" },
    { id: "email" as const, label: "Email-gated" },
    { id: "magic_link" as const, label: "Magic-link account" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">Gate (Link only)</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all hover:bg-muted/50",
                isActive
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              <input
                type="radio"
                name="auth-mode"
                checked={isActive}
                onChange={() => onChange(option.id)}
                className="accent-primary cursor-pointer h-3.5 w-3.5"
              />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
