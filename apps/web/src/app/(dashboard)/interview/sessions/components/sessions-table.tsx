"use client";

import React, { useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { History } from "lucide-react";
import { DataTable } from "@/components/ui/data-display/data-table";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { StatusBadge } from "@repo/ui/composites/status-badge";
import { Badge } from "@repo/ui/primitives/badge";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { ExpandableSearch } from "@repo/ui/composites/expandable-search";
import {
  DisplayPopover,
  type DisplaySettings,
} from "@repo/ui/composites/display-popover";
import { useDisplaySettings } from "@/hooks/use-display-settings";
import {
  useInterviewSessionsQuery,
  type InterviewSessionSummary,
} from "@/hooks/use-interview-sessions-query";

function relativeTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

const STATUS_VARIANTS: Record<string, string> = {
  live: "active",
  ended: "idle",
  consent: "paused",
  error: "error",
  scheduled: "scheduled",
};

const GROUPING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "status", label: "Status" },
  { value: "style", label: "Style" },
];

const ORDERING_OPTIONS = [
  { value: "createdAt-desc", label: "Newest first" },
  { value: "createdAt-asc", label: "Oldest first" },
];

const DISPLAY_PROPERTIES = [
  { id: "style", label: "Style" },
  { id: "guestName", label: "Guest" },
  { id: "maxDurationSec", label: "Max duration" },
  { id: "createdAt", label: "Started" },
];

const DEFAULT_SETTINGS: DisplaySettings = {
  view: "list",
  grouping: "none",
  subGrouping: "none",
  ordering: "createdAt",
  orderDirection: "desc",
  showEmptyGroups: false,
  visibleProperties: new Set([
    "style",
    "guestName",
    "maxDurationSec",
    "createdAt",
  ]),
};

export function SessionsTable() {
  const { data: sessions = [], isLoading } = useInterviewSessionsQuery();

  const [displaySettings, setDisplaySettings] = useDisplaySettings(
    "interview-sessions-table-display",
    DEFAULT_SETTINGS,
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.topic?.toLowerCase().includes(q) ||
        s.guestName?.toLowerCase().includes(q),
    );
  }, [sessions, searchQuery]);

  const columns = useMemo<ColumnDef<InterviewSessionSummary>[]>(() => {
    const cols: ColumnDef<InterviewSessionSummary>[] = [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={STATUS_VARIANTS[row.original.status] ?? row.original.status}
          />
        ),
      },
      {
        accessorKey: "topic",
        header: "Topic",
        cell: ({ row }) => {
          const text = row.original.topic ?? "Untitled Interview";
          const truncated = text.length > 60 ? text.slice(0, 60) + "…" : text;
          const isLive = row.original.status === "live";
          const isScheduled = row.original.status === "scheduled";
          return (
            <div className="flex items-center gap-2">
              {isScheduled ? (
                <span className="font-medium text-foreground">{truncated}</span>
              ) : (
                <Link
                  href={`/interview/sessions/${row.original.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {truncated}
                </Link>
              )}
              {isLive && (
                <Link href={`/interview/sessions/${row.original.id}/live-watch`}>
                  <Badge variant="destructive" className="text-[10px] animate-pulse cursor-pointer">
                    Live Watch
                  </Badge>
                </Link>
              )}
            </div>
          );
        },
      },
    ];

    if (displaySettings.visibleProperties.has("style")) {
      cols.push({
        accessorKey: "style",
        header: "Style",
        cell: ({ row }) =>
          row.original.style ? (
            <Badge variant="secondary" className="capitalize">
              {row.original.style}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      });
    }

    if (displaySettings.visibleProperties.has("guestName")) {
      cols.push({
        accessorKey: "guestName",
        header: "Guest",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.guestName ?? "—"}
          </span>
        ),
      });
    }

    if (displaySettings.visibleProperties.has("maxDurationSec")) {
      cols.push({
        accessorKey: "maxDurationSec",
        header: "Max duration",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDuration(row.original.maxDurationSec)}
          </span>
        ),
      });
    }

    if (displaySettings.visibleProperties.has("createdAt")) {
      cols.push({
        accessorKey: "createdAt",
        header: "Started",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {relativeTime(row.original.createdAt)}
          </span>
        ),
      });
    }

    return cols;
  }, [displaySettings]);

  const isEmpty = !isLoading && filtered.length === 0;

  if (isEmpty && !searchQuery) {
    return (
      <EmptyState
        icon={History}
        title="No interview sessions yet"
        description="Once a guest starts an interview from one of your share links, the session will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <TableToolbar
        left={null}
        right={
          <>
            <DisplayPopover
              settings={displaySettings}
              onSettingsChange={setDisplaySettings}
              groupingOptions={GROUPING_OPTIONS}
              orderingOptions={ORDERING_OPTIONS}
              displayProperties={DISPLAY_PROPERTIES}
              defaultSettings={DEFAULT_SETTINGS}
            />
            <ExpandableSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by topic or guest..."
            />
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(row) => row.id}
          enableSorting
          sorting={sorting}
          onSortingChange={setSorting}
          tableId="interview-sessions-table"
          emptyMessage={
            isLoading ? "Loading sessions..." : "No sessions match search filter."
          }
        />
      </div>
    </div>
  );
}
