"use client";

import * as React from "react";
import {
  Table2,
  LayoutGrid,
  Network,
  ArrowUpDown,
  Layers,
  Settings2,
  Calendar,
  GitBranch,
} from "lucide-react";
import { cn } from "../utils";
import { Button } from "../primitives/button";
import { Switch } from "../primitives/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover";
import {
  ComboboxSelect,
  type ComboboxOption,
} from "./combobox-select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewType = "list" | "board" | "graph" | "calendar" | "org";

export interface DisplayProperty {
  id: string;
  label: string;
}

export interface DisplaySettings {
  view: ViewType;
  grouping: string;
  subGrouping: string;
  ordering: string;
  orderDirection: "asc" | "desc";
  showEmptyGroups: boolean;
  visibleProperties: Set<string>;
  graphTagEdges?: boolean;
  graphTemporalEdges?: boolean;
  graphTemporalGapHours?: number;
  graphEntityEdges?: boolean;
}

// ---------------------------------------------------------------------------
// Hook — useDisplaySettings
// ---------------------------------------------------------------------------

export function useDisplaySettings(
  pageKey: string,
  defaultSettings: DisplaySettings
): [DisplaySettings, (s: DisplaySettings) => void] {
  const [settings, setSettingsRaw] = React.useState<DisplaySettings>(defaultSettings);

  // Sync from localStorage after hydration to avoid server/client mismatch
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(`display-settings:${pageKey}`);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      // Merge with defaults so missing/stale fields don't produce undefined values.
      // Validate visibleProperties: fall back to defaults if missing or empty
      // (e.g. stale localStorage from before visibleProperties was added).
      const visibleProperties =
        Array.isArray(parsed.visibleProperties) && parsed.visibleProperties.length > 0
          ? new Set<string>(parsed.visibleProperties)
          : defaultSettings.visibleProperties;
      setSettingsRaw({
        ...defaultSettings,
        ...parsed,
        visibleProperties,
      });
    } catch {
      // localStorage may be unavailable — silently ignore
    }
  }, [pageKey, defaultSettings]);

  const setSettings = React.useCallback(
    (next: DisplaySettings) => {
      setSettingsRaw(next);
      try {
        localStorage.setItem(
          `display-settings:${pageKey}`,
          JSON.stringify({
            ...next,
            visibleProperties: Array.from(next.visibleProperties),
          })
        );
      } catch {
        // localStorage may be unavailable — silently ignore
      }
    },
    [pageKey]
  );

  return [settings, setSettings];
}

// ---------------------------------------------------------------------------
// DisplayPopover
// ---------------------------------------------------------------------------

interface DisplayPopoverProps {
  settings: DisplaySettings;
  onSettingsChange: (settings: DisplaySettings) => void;
  groupingOptions: ComboboxOption[];
  orderingOptions: ComboboxOption[];
  displayProperties: DisplayProperty[];
  defaultSettings: DisplaySettings;
  enableBoardView?: boolean;
  enableGraphView?: boolean;
  enableCalendarView?: boolean;
  enableOrgView?: boolean;
  extraToggles?: React.ReactNode;
}

export function DisplayPopover({
  settings,
  onSettingsChange,
  groupingOptions,
  orderingOptions,
  displayProperties,
  defaultSettings,
  enableBoardView = true,
  enableGraphView = false,
  enableCalendarView = false,
  enableOrgView = false,
  extraToggles,
}: DisplayPopoverProps) {
  const update = (patch: Partial<DisplaySettings>) =>
    onSettingsChange({ ...settings, ...patch });

  const toggleProperty = (id: string) => {
    const next = new Set(settings.visibleProperties);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    update({ visibleProperties: next });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Settings2 className="size-3.5" />
          Display
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[320px] p-0" align="end">
        {/* ---- View Type Tabs ---- */}
        <div className="flex items-center gap-1 border-b p-3">
          <Button
            variant={settings.view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => update({ view: "list" })}
          >
            <Table2 className="size-3.5" />
            List
          </Button>
          {enableBoardView && (
            <Button
              variant={settings.view === "board" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => update({ view: "board" })}
            >
              <LayoutGrid className="size-3.5" />
              Board
            </Button>
          )}
          {enableGraphView && (
            <Button
              variant={settings.view === "graph" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => update({ view: "graph" })}
            >
              <Network className="size-3.5" />
              Graph
            </Button>
          )}
          {enableCalendarView && (
            <Button
              variant={settings.view === "calendar" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => update({ view: "calendar" })}
            >
              <Calendar className="size-3.5" />
              Calendar
            </Button>
          )}
          {enableOrgView && (
            <Button
              variant={settings.view === "org" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => update({ view: "org" })}
            >
              <GitBranch className="size-3.5" />
              Org
            </Button>
          )}
        </div>

        {/* ---- Grouping & Ordering ---- */}
        {settings.view !== "graph" && settings.view !== "org" && (
          <div className="space-y-2.5 border-b p-3">
            {/* Grouping */}
            <div className="flex items-center gap-2">
              <div className="flex min-w-[90px] items-center gap-1.5 text-xs text-muted-foreground">
                <Layers className="size-3.5" />
                Grouping
              </div>
              <ComboboxSelect
                value={settings.grouping}
                onValueChange={(v) => update({ grouping: v })}
                options={groupingOptions}
                className="flex-1"
              />
            </div>

            {/* Sub-grouping */}
            <div className="flex items-center gap-2">
              <div className="flex min-w-[90px] items-center gap-1.5 text-xs text-muted-foreground">
                <Layers className="size-3.5" />
                Sub-grouping
              </div>
              <ComboboxSelect
                value={settings.subGrouping}
                onValueChange={(v) => update({ subGrouping: v })}
                options={groupingOptions}
                className="flex-1"
              />
            </div>

            {/* Ordering */}
            <div className="flex items-center gap-2">
              <div className="flex min-w-[90px] items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowUpDown className="size-3.5" />
                Ordering
              </div>
              <ComboboxSelect
                value={settings.ordering}
                onValueChange={(v) => update({ ordering: v })}
                options={orderingOptions}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon-xs"
                className="size-8 shrink-0"
                onClick={() =>
                  update({
                    orderDirection:
                      settings.orderDirection === "asc" ? "desc" : "asc",
                  })
                }
                aria-label="Toggle sort direction"
              >
                <ArrowUpDown
                  className={cn(
                    "size-3.5 transition-transform",
                    settings.orderDirection === "desc" && "rotate-180"
                  )}
                />
              </Button>
            </div>
          </div>
        )}

        {/* ---- Graph Connections ---- */}
        {settings.view === "graph" && (
          <div className="space-y-2.5 border-b p-3">
            <span className="text-xs font-medium">Connections</span>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tag connections</span>
              <Switch
                checked={settings.graphTagEdges !== false}
                onCheckedChange={(v) => update({ graphTagEdges: !!v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Entity connections</span>
              <Switch
                checked={settings.graphEntityEdges === true}
                onCheckedChange={(v) => update({ graphEntityEdges: !!v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Temporal proximity</span>
              <Switch
                checked={settings.graphTemporalEdges === true}
                onCheckedChange={(v) => update({ graphTemporalEdges: !!v })}
              />
            </div>
            {settings.graphTemporalEdges && (
              <div className="flex items-center gap-2">
                <div className="flex min-w-[90px] items-center gap-1.5 text-xs text-muted-foreground">
                  Time gap
                </div>
                <ComboboxSelect
                  value={String(settings.graphTemporalGapHours ?? 24)}
                  onValueChange={(v) => update({ graphTemporalGapHours: Number(v) })}
                  options={[
                    { value: "1", label: "1 hour" },
                    { value: "6", label: "6 hours" },
                    { value: "24", label: "1 day" },
                    { value: "168", label: "7 days" },
                  ]}
                  className="flex-1"
                />
              </div>
            )}
          </div>
        )}

        {/* ---- Options ---- */}
        <div className="space-y-2.5 border-b p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Show empty groups
            </span>
            <Switch
              checked={settings.showEmptyGroups}
              onCheckedChange={(v) => update({ showEmptyGroups: !!v })}
            />
          </div>
          {extraToggles}
        </div>

        {/* ---- Display Properties ---- */}
        <div className="space-y-2 border-b p-3">
          <span className="text-xs font-medium">Display properties</span>
          <div className="flex flex-wrap gap-1">
            {displayProperties.map((prop) => (
              <Button
                key={prop.id}
                variant={
                  settings.visibleProperties.has(prop.id)
                    ? "secondary"
                    : "outline"
                }
                className="h-6 px-2 text-[11px]"
                onClick={() => toggleProperty(prop.id)}
              >
                {prop.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ---- Footer ---- */}
        <div className="flex justify-end p-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSettingsChange(defaultSettings)}
          >
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
