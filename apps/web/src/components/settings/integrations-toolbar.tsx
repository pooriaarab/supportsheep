"use client";

import * as React from "react";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { ExpandableSearch } from "@repo/ui/composites/expandable-search";
import {
  DisplayPopover,
  type DisplaySettings,
} from "@repo/ui/composites/display-popover";
import { type FilterItem, TableFilter } from "@repo/ui/composites/table-filter";
import { FilterChips, type FilterChip } from "@repo/ui/composites/filter-chips";
import { FilterIcon, FilterOption } from "@repo/ui/composites/filter-option";
import { Button } from "@repo/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/primitives/tooltip";
import { cn } from "@repo/ui/utils";
import { Plus, CircleDot, Cable } from "lucide-react";
import {
  INTEGRATION_GROUPING_OPTIONS,
  INTEGRATION_ORDERING_OPTIONS,
  INTEGRATION_DISPLAY_PROPERTIES,
  INTEGRATION_DEFAULT_SETTINGS,
} from "@/app/(dashboard)/settings/integrations/constants";

export type IntegrationStatusFilter =
  | "all"
  | "connected"
  | "disconnected"
  | "error";

export type IntegrationTypeFilter = "all" | "oauth" | "api_key" | "webhook";

const STATUS_OPTIONS: { label: string; value: IntegrationStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Connected", value: "connected" },
  { label: "Disconnected", value: "disconnected" },
  { label: "Error", value: "error" },
];

const TYPE_OPTIONS: { label: string; value: IntegrationTypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "OAuth", value: "oauth" },
  { label: "API Key", value: "api_key" },
  { label: "Webhook", value: "webhook" },
];

const TYPE_LABELS: Record<string, string> = {
  oauth: "OAuth",
  api_key: "API Key",
  webhook: "Webhook",
};

interface IntegrationsToolbarProps {
  displaySettings: DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: IntegrationStatusFilter;
  typeFilter: IntegrationTypeFilter;
  onStatusFilterChange: (value: IntegrationStatusFilter) => void;
  onTypeFilterChange: (value: IntegrationTypeFilter) => void;
  onAddIntegration: () => void;
}

export function IntegrationsToolbar({
  displaySettings,
  onDisplaySettingsChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  typeFilter,
  onStatusFilterChange,
  onTypeFilterChange,
  onAddIntegration,
}: IntegrationsToolbarProps) {
  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all";

  const filterItems: FilterItem[] = React.useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        icon: <CircleDot className="size-4 opacity-60" />,
        content: (
          <div className="space-y-0.5">
            {STATUS_OPTIONS.map((opt) => (
              <FilterOption
                key={opt.value}
                label={opt.label}
                selected={statusFilter === opt.value}
                onClick={() => onStatusFilterChange(opt.value)}
              />
            ))}
          </div>
        ),
      },
      {
        id: "type",
        label: "Type",
        icon: <Cable className="size-4 opacity-60" />,
        content: (
          <div className="space-y-0.5">
            {TYPE_OPTIONS.map((opt) => (
              <FilterOption
                key={opt.value}
                label={opt.label}
                selected={typeFilter === opt.value}
                onClick={() => onTypeFilterChange(opt.value)}
              />
            ))}
          </div>
        ),
      },
    ],
    [statusFilter, typeFilter, onStatusFilterChange, onTypeFilterChange],
  );

  const filterChips = React.useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (statusFilter !== "all") {
      chips.push({
        id: "status",
        label: "Status",
        value: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1),
        onRemove: () => onStatusFilterChange("all"),
      });
    }
    if (typeFilter !== "all") {
      chips.push({
        id: "type",
        label: "Type",
        value: TYPE_LABELS[typeFilter] ?? typeFilter,
        onRemove: () => onTypeFilterChange("all"),
      });
    }
    return chips;
  }, [statusFilter, typeFilter, onStatusFilterChange, onTypeFilterChange]);

  const filterTrigger = React.useMemo(
    () => (
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 gap-1.5 text-xs hover:bg-accent hover:text-accent-foreground",
            hasActiveFilters
              ? "text-foreground bg-accent"
              : "text-muted-foreground",
          )}
        >
          <FilterIcon className="size-4" />
          {!hasActiveFilters && <span>Filter</span>}
        </Button>
      </TooltipTrigger>
    ),
    [hasActiveFilters],
  );

  return (
    <>
      <TableToolbar
        left={
          <>
            <Tooltip>
              <TableFilter
                items={filterItems}
                showSearch
                searchPlaceholder="Add Filter..."
                showHeader={false}
                trigger={filterTrigger}
              />
              <TooltipContent side="top">Filter</TooltipContent>
            </Tooltip>
            <FilterChips chips={filterChips} />
          </>
        }
        right={
          <>
            <DisplayPopover
              settings={displaySettings}
              onSettingsChange={onDisplaySettingsChange}
              groupingOptions={INTEGRATION_GROUPING_OPTIONS}
              orderingOptions={INTEGRATION_ORDERING_OPTIONS}
              displayProperties={INTEGRATION_DISPLAY_PROPERTIES}
              defaultSettings={INTEGRATION_DEFAULT_SETTINGS}
              enableBoardView
            />
            <ExpandableSearch
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search integrations..."
            />
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onAddIntegration}
            >
              <Plus className="size-3.5" />
              Add Integration
            </Button>
          </>
        }
      />
    </>
  );
}
