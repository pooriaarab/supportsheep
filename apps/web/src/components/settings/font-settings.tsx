"use client";

import { Label } from "@repo/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { useAppTheme } from "@/contexts/theme-provider";
import { FONT_OPTIONS } from "@/lib/fonts";

export function FontSettings() {
  const { fontId, setFontId } = useAppTheme();

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Label className="text-sm font-medium text-foreground/80">
          Font Family
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a font for the dashboard UI
        </p>
      </div>
      <Select value={fontId} onValueChange={setFontId}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select font" />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((font) => (
            <SelectItem key={font.id} value={font.id}>
              <span className="flex items-center gap-2">
                <span>{font.name}</span>
                <span className="text-muted-foreground text-xs">
                  {font.description}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
