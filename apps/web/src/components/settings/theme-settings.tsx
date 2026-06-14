"use client";

import { useTheme } from "next-themes";
import { Label } from "@repo/ui/primitives/label";
import { cn } from "@repo/ui/utils";
import { useAppTheme } from "@/contexts/theme-provider";
import { getAvailableThemes } from "@/lib/themes";

export function ThemeSettings() {
  const { resolvedTheme } = useTheme();
  const { themeId, setThemeId } = useAppTheme();
  const availableThemes = getAvailableThemes();

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium text-foreground/80">Theme</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a color theme for the dashboard
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {availableThemes.map((preset) => {
          const isActive = preset.id === themeId;
          const preview =
            resolvedTheme === "dark"
              ? (preset.preview.dark ?? preset.preview.light)
              : (preset.preview.light ?? preset.preview.dark);
          if (!preview) return null;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setThemeId(preset.id)}
              className={cn(
                "relative rounded-lg border-2 p-3 text-left transition-colors",
                isActive
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-muted-foreground/30",
              )}
            >
              <div className="flex gap-1.5 mb-2">
                <div
                  className="size-8 rounded-md border border-border/50"
                  style={{ backgroundColor: preview.bg }}
                />
                <div
                  className="size-8 rounded-md border border-border/50"
                  style={{ backgroundColor: preview.sidebar }}
                />
                <div
                  className="size-8 rounded-md border border-border/50"
                  style={{ backgroundColor: preview.accent }}
                />
                <div
                  className="h-8 w-3 rounded-md border border-border/50"
                  style={{ backgroundColor: preview.fg }}
                />
              </div>
              <span className="text-xs font-medium">{preset.name}</span>
              {preset.mode !== "both" && (
                <span className="text-xs text-muted-foreground ml-1.5">
                  ({preset.mode})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
