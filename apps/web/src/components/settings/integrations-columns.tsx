"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@repo/ui/primitives/badge";
import { Button } from "@repo/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import { MoreVertical, Unplug, Trash2, Settings } from "lucide-react";
import { StatusBadge } from "@repo/ui/composites/status-badge";
import type { Integration } from "@/hooks/use-integrations-query";

interface UseIntegrationColumnsOptions {
  onDisconnect: (id: string) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  oauth: "OAuth",
  api_key: "API Key",
  webhook: "Webhook",
};

const STATUS_MAP: Record<string, string> = {
  connected: "active",
  disconnected: "idle",
  error: "error",
};

function formatDate(dateString: string | number): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeTime(dateString: string | number): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function useIntegrationColumns({
  onDisconnect,
  onDelete,
}: UseIntegrationColumnsOptions) {
  return useMemo<ColumnDef<Integration>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        size: 200,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-foreground">
                {row.original.icon}
              </span>
            </div>
            <span className="font-medium text-foreground">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 100,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs font-normal">
            {TYPE_LABELS[row.original.type] ?? row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        cell: ({ row }) => (
          <StatusBadge
            status={STATUS_MAP[row.original.status] ?? "idle"}
          />
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 250,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground line-clamp-1">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "connectedAt",
        header: "Connected",
        size: 120,
        cell: ({ row }) =>
          row.original.connectedAt ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {relativeTime(row.original.connectedAt)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">--</span>
          ),
      },
      {
        id: "actions",
        header: "",
        size: 48,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                aria-label="More options"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Settings className="size-3.5 mr-2" />
                Configure
              </DropdownMenuItem>
              {row.original.status === "connected" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisconnect(row.original.id);
                  }}
                >
                  <Unplug className="size-3.5 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(row.original.id);
                }}
                className="text-error focus:text-error"
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onDisconnect, onDelete],
  );
}
