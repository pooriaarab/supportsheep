"use client";

import React from "react";
import { Building2, Link2, Lock, type LucideIcon } from "lucide-react";
import type { ShareLinkVisibility } from "@/lib/interviews/share-link-schema";
import { cn } from "@/lib/utils";

interface ShareVisibilitySectionProps {
  value: ShareLinkVisibility;
  onChange: (value: ShareLinkVisibility) => void;
}

interface VisibilityOption {
  id: ShareLinkVisibility;
  title: string;
  description: string;
  icon: LucideIcon;
}

const OPTIONS: VisibilityOption[] = [
  {
    id: "private",
    title: "Private",
    description: "Workspace members only. No external access.",
    icon: Lock,
  },
  {
    id: "link",
    title: "Link",
    description: "Anyone with the link. Configure a gate below.",
    icon: Link2,
  },
  {
    id: "workspace",
    title: "Workspace",
    description: "Anyone signed into this workspace.",
    icon: Building2,
  },
];

export function ShareVisibilitySection({
  value,
  onChange,
}: ShareVisibilitySectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">Who can join</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const isActive = value === option.id;
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:bg-muted/50",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold",
                  isActive ? "text-primary" : "text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {option.title}
              </div>
              <div className="text-[11px] text-muted-foreground leading-normal">
                {option.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
