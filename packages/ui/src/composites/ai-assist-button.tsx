"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../primitives/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover";
import { Input } from "../primitives/input";
import { cn } from "../utils";

export interface AiAssistPreset {
  label: string;
  value: string;
}

interface AiAssistButtonProps {
  presets: AiAssistPreset[];
  onGenerate: (instruction: string) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AiAssistButton({
  presets,
  onGenerate,
  loading = false,
  disabled = false,
  className,
}: AiAssistButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [customInstruction, setCustomInstruction] = React.useState("");
  const clickCount = React.useRef(0);
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle single vs double click without conflicting with Radix.
  // We prevent the default Radix toggle and manage open state ourselves
  // so the 200ms detection window doesn't race with PopoverTrigger.
  const openAssistOrRunFirstPreset = React.useCallback(
    (e: React.MouseEvent) => {
      // Prevent Radix PopoverTrigger from toggling on its own
      e.preventDefault();
      if (loading || disabled) return;

      clickCount.current += 1;

      if (clickCount.current === 1) {
        clickTimer.current = setTimeout(() => {
          // Single click → open popover
          clickCount.current = 0;
          setOpen(true);
        }, 250);
      } else if (clickCount.current >= 2) {
        // Double click → fire immediately with first preset
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
        }
        clickCount.current = 0;
        if (presets.length > 0) {
          onGenerate(presets[0].value);
        }
      }
    },
    [presets, onGenerate, loading, disabled],
  );

  const runPresetInstruction = React.useCallback(
    (value: string) => {
      setOpen(false);
      setCustomInstruction("");
      onGenerate(value);
    },
    [onGenerate],
  );

  const generateCustomInstruction = React.useCallback(() => {
    if (!customInstruction.trim()) return;
    setOpen(false);
    onGenerate(customInstruction.trim());
    setCustomInstruction("");
  }, [customInstruction, onGenerate]);

  React.useEffect(() => {
    return () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-6", className)}
          disabled={disabled || loading}
          onClick={openAssistOrRunFirstPreset}
          title="Double-click for quick AI assist"
        >
          <Sparkles
            className={cn(
              "size-3.5",
              loading && "animate-pulse text-primary",
              !loading && "text-muted-foreground hover:text-foreground",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 space-y-2.5">
        <p className="text-xs font-medium text-muted-foreground">AI Assist</p>
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className="text-[11px] px-2 py-1 rounded-md bg-muted hover:bg-accent text-foreground transition-colors"
              onClick={() => runPresetInstruction(preset.value)}
              disabled={loading}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input
            placeholder="Custom instructions…"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                generateCustomInstruction();
              }
            }}
            className="h-7 text-xs flex-1"
            disabled={loading}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={generateCustomInstruction}
            disabled={!customInstruction.trim() || loading}
          >
            Generate
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
