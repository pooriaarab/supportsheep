"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import { Button } from "../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { Input } from "../primitives/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

export interface FilterItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  shortcut?: string;
}

export interface FilterGroup {
  id: string;
  items: FilterItem[];
}

interface TableFilterProps {
  items?: FilterItem[];
  groups?: FilterGroup[];
  trigger?: React.ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchKeyboardShortcut?: string;
  showHeader?: boolean;
  headerTitle?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const EMPTY_ITEMS: FilterItem[] = [];
const EMPTY_GROUPS: FilterGroup[] = [];

const DEFAULT_FILTER_TRIGGER = (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 gap-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Filter className="size-4" />
        Filter
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">Filter</TooltipContent>
  </Tooltip>
);

export function TableFilter({
  items = EMPTY_ITEMS,
  groups = EMPTY_GROUPS,
  trigger,
  showSearch = false,
  searchPlaceholder = "Filter by…",
  searchKeyboardShortcut,
  showHeader = true,
  headerTitle = "Filter",
  open,
  onOpenChange,
}: TableFilterProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const isOpen = open !== undefined ? open : internalOpen;
  const handleOpenChange = (newOpen: boolean) => {
    const handler = onOpenChange ?? setInternalOpen;
    handler(newOpen);
    if (!newOpen) setSearchQuery("");
  };

  React.useEffect(() => {
    if (!isOpen || !showSearch || !searchInputRef.current) return;

    const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 0);

    return () => clearTimeout(focusTimer);
  }, [isOpen, showSearch]);

  const allItems = React.useMemo(() => {
    if (items.length > 0) return items;
    return groups.flatMap((group) => group.items);
  }, [items, groups]);

  const filteredItems = React.useMemo(() => {
    if (!showSearch || !searchQuery) return allItems;
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allItems, searchQuery, showSearch]);

  const filteredGroups = React.useMemo(() => {
    if (items.length > 0 || groups.length === 0) {
      return [{ id: "default", items: filteredItems }];
    }
    const filteredItemSet = new Set(filteredItems);
    const nextGroups: FilterGroup[] = [];

    for (const group of groups) {
      const groupItems = group.items.filter((item) => filteredItemSet.has(item));
      if (groupItems.length > 0) {
        nextGroups.push({ ...group, items: groupItems });
      }
    }

    return nextGroups;
  }, [groups, filteredItems, items.length]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{trigger ?? DEFAULT_FILTER_TRIGGER}</DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-52 p-0">
        {showHeader && (
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">{headerTitle}</span>
          </div>
        )}

        {showSearch && (
          <div className="p-2">
            <div className="relative">
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm pr-10"
                aria-label="Search filter values"
              />
              {searchKeyboardShortcut && (
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-60">
                  {searchKeyboardShortcut}
                </kbd>
              )}
            </div>
          </div>
        )}

        <div className="py-1">
          {filteredGroups.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No filters found
            </div>
          ) : (
            filteredGroups.map((group, groupIndex) => (
              <React.Fragment key={group.id}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                <div className="px-1">
                  {group.items.map((item) => (
                    <DropdownMenuSub key={item.id}>
                      <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm">
                        {item.icon}
                        <span>{item.label}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48 p-1">
                        {item.content}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </div>
              </React.Fragment>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
