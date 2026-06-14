"use client";

import { TableToolbar } from "@/components/shared/table-toolbar";
import { ExpandableSearch } from "@repo/ui/composites/expandable-search";
import {
  DisplayPopover,
  type DisplaySettings,
} from "@repo/ui/composites/display-popover";
import { Button } from "@repo/ui/primitives/button";
import { Plus } from "lucide-react";
import {
  POST_GROUPING_OPTIONS,
  POST_ORDERING_OPTIONS,
  POST_DISPLAY_PROPERTIES,
  POST_DEFAULT_SETTINGS,
} from "@/app/(dashboard)/posts/constants";

interface PostsToolbarProps {
  displaySettings: DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewPost: () => void;
}

export function PostsToolbar({
  displaySettings,
  onDisplaySettingsChange,
  searchQuery,
  onSearchChange,
  onNewPost,
}: PostsToolbarProps) {
  return (
    <TableToolbar
      left={null}
      right={
        <>
          <DisplayPopover
            settings={displaySettings}
            onSettingsChange={onDisplaySettingsChange}
            groupingOptions={POST_GROUPING_OPTIONS}
            orderingOptions={POST_ORDERING_OPTIONS}
            displayProperties={POST_DISPLAY_PROPERTIES}
            defaultSettings={POST_DEFAULT_SETTINGS}
          />
          <ExpandableSearch
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search posts…"
          />
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onNewPost}>
            <Plus className="size-3.5" />
            New Post
          </Button>
        </>
      }
    />
  );
}
