"use client";

import React from "react";
import { FileText, Mic, type LucideIcon, Video } from "lucide-react";
import type { RecordingConfig } from "@/lib/interviews/share-link-schema";
import { cn } from "@/lib/utils";
import { Badge } from "@repo/ui/primitives/badge";

interface ShareRecordingSectionProps {
  value: RecordingConfig;
  onChange: (value: RecordingConfig) => void;
}

interface RecordingOption {
  id: RecordingConfig;
  title: string;
  description: string;
  disabled: boolean;
  icon: LucideIcon;
}

const OPTIONS: RecordingOption[] = [
  {
    id: "transcript",
    title: "Transcript only",
    description: "Text transcript only. Audio is processed and discarded.",
    disabled: false,
    icon: FileText,
  },
  {
    id: "audio",
    title: "+ Audio",
    description: "Save the audio for review and quote-verification.",
    disabled: false,
    icon: Mic,
  },
  {
    id: "video",
    title: "+ Video",
    description: "Tavus video - interactive avatar interview.",
    disabled: false,
    icon: Video,
  },
];

export function ShareRecordingSection({ value, onChange }: ShareRecordingSectionProps) {
  const options = OPTIONS;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">What we capture</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const isActive = value === option.id;
          const isButtonDisabled = option.disabled;

          return (
            <button
              key={option.id}
              type="button"
              disabled={isButtonDisabled}
              onClick={() => {
                if (!isButtonDisabled) {
                  onChange(option.id as RecordingConfig);
                }
              }}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all relative",
                isButtonDisabled
                  ? "opacity-50 cursor-not-allowed border-border bg-card"
                  : isActive
                  ? "border-primary bg-primary/5 hover:bg-primary/5 cursor-pointer"
                  : "border-border bg-card hover:bg-muted/50 cursor-pointer"
              )}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-semibold",
                    isActive && !isButtonDisabled
                      ? "text-primary"
                      : "text-foreground",
                  )}
                >
                  <option.icon className="size-3.5" />
                  {option.title}
                </span>
                {isButtonDisabled && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-border bg-muted">
                    Soon
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground leading-normal mt-1">
                {option.description}
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-[11px] text-muted-foreground">
        The guest sees an explicit consent screen before joining.
      </div>
    </div>
  );
}
