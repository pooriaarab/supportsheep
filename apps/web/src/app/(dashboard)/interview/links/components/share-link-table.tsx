/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo, useCallback } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-display/data-table";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { ExpandableSearch } from "@repo/ui/composites/expandable-search";
import { DisplayPopover, type DisplaySettings } from "@repo/ui/composites/display-popover";
import { Button } from "@repo/ui/primitives/button";
import { StatusBadge } from "@repo/ui/composites/status-badge";
import { BottomBulkActionsBar } from "@repo/ui/composites/bottom-bulk-actions-bar";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import { Badge } from "@repo/ui/primitives/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import { Plus, MoreVertical, RotateCw, Eye, Ban, Link2 } from "lucide-react";
import { useShareLinksQuery, useRevokeShareLink } from "@/hooks/use-share-links-query";
import type { ShareLinkSummary } from "@/hooks/use-share-links-query";
import { useDisplaySettings } from "@/hooks/use-display-settings";
import { useAuth } from "@/contexts/auth-context";
import { useUserQuery } from "@/hooks/use-users-query";
import { toast } from "sonner";
import { QuickCreateDialog } from "./quick-create-dialog";
import { ShareLinkDialog } from "./share-link-dialog";
import { RegenerateShareLinkDialog } from "./regenerate-share-link-dialog";
import Link from "next/link";

// Formatter helpers
function relativeTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Never";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Display popover constants
const TABLE_GROUPING_OPTIONS: any = [
  { value: "none", label: "None" },
  { value: "status", label: "Status" },
  { value: "type", label: "Type" },
];

const TABLE_ORDERING_OPTIONS: any = [
  { value: "createdAt-desc", label: "Newest first" },
  { value: "createdAt-asc", label: "Oldest first" },
  { value: "topic-asc", label: "Topic (A-Z)" },
];

const TABLE_DISPLAY_PROPERTIES: any = [
  { value: "type", label: "Type" },
  { value: "style", label: "Style" },
  { value: "uses", label: "Uses" },
  { value: "expiresAt", label: "Expires" },
  { value: "createdAt", label: "Created" },
];

const TABLE_DEFAULT_SETTINGS: DisplaySettings = {
  view: "list",
  grouping: "none",
  subGrouping: "none",
  ordering: "createdAt",
  orderDirection: "desc",
  showEmptyGroups: false,
  visibleProperties: new Set(["type", "style", "uses", "expiresAt", "createdAt"]),
};

export function ShareLinkTable() {
  const { user: currentUser } = useAuth();
  const { data: userProfile } = useUserQuery(currentUser?.uid ?? "");

  // Check role authorization: only admin/owner can revoke
  const canRevoke = useMemo(() => {
    if (!userProfile) return false;
    const role = userProfile.role;
    return role === "admin" || role === "owner";
  }, [userProfile]);

  // Display Settings
  const [displaySettings, setDisplaySettings] = useDisplaySettings(
    "share-links-table-display",
    TABLE_DEFAULT_SETTINGS
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  // Fetch data
  const { data: shareLinks = [], isLoading } = useShareLinksQuery();
  const revokeLink = useRevokeShareLink();

  // Dialog flow states
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [fullCreateOpen, setFullCreateOpen] = useState(false);
  const [pendingTopic, setTopicPass] = useState("");

  // Table selection & bulk state
  const [selectedItems, setSelectedItems] = useState<ShareLinkSummary[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [singleRevokingId, setSingleRevokingId] = useState<string | null>(null);
  const [regenTarget, setRegenTarget] = useState<{
    id: string;
    topic: string | null;
  } | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLinks = useMemo(() => {
    return shareLinks.filter((link) => {
      if (!searchQuery) return true;
      const topicText = link.topic?.toLowerCase() || "";
      return topicText.includes(searchQuery.toLowerCase());
    });
  }, [shareLinks, searchQuery]);

  const handleRevokeSingle = useCallback(async () => {
    if (!singleRevokingId) return;
    try {
      await revokeLink.mutateAsync(singleRevokingId);
      setSingleRevokingId(null);
    } catch {
      // Handled by hook
    }
  }, [singleRevokingId, revokeLink]);

  const handleBulkRevoke = useCallback(async () => {
    try {
      await Promise.all(selectedItems.map((item) => revokeLink.mutateAsync(item.id)));
      toast.success(`Revoked ${selectedItems.length} share links`);
      setSelectedItems([]);
      setBulkConfirmOpen(false);
    } catch {
      // Handled by hook
    }
  }, [selectedItems, revokeLink]);

  const columns = useMemo<ColumnDef<ShareLinkSummary>[]>(() => {
    const cols: ColumnDef<ShareLinkSummary>[] = [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "topic",
        header: "Topic",
        cell: ({ row }) => {
          const text = row.original.topic || "Untitled Interview";
          const truncated = text.length > 50 ? text.substring(0, 50) + "..." : text;
          return (
            <Link
              href={`/interview/links/${row.original.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {truncated}
            </Link>
          );
        },
      },
    ];

    if (displaySettings.visibleProperties.has("type")) {
      cols.push({
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary" className="capitalize">
            {row.original.type}
          </Badge>
        ),
      });
    }

    if (displaySettings.visibleProperties.has("style")) {
      cols.push({
        accessorKey: "style",
        header: "Style",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground capitalize">
            {row.original.style}
          </span>
        ),
      });
    }

    if (displaySettings.visibleProperties.has("uses")) {
      cols.push({
        accessorKey: "uses",
        header: "Uses",
        cell: ({ row }) => {
          const max = row.original.maxUses;
          return (
            <span className="text-xs text-muted-foreground">
              {row.original.uses} / {max !== null ? max : "∞"}
            </span>
          );
        },
      });
    }

    if (displaySettings.visibleProperties.has("expiresAt")) {
      cols.push({
        accessorKey: "expiresAt",
        header: "Expires",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.original.expiresAt)}
          </span>
        ),
      });
    }

    if (displaySettings.visibleProperties.has("createdAt")) {
      cols.push({
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {relativeTime(row.original.createdAt)}
          </span>
        ),
      });
    }

    // Actions Column
    cols.push({
      id: "actions",
      cell: ({ row }) => {
        const link = row.original;
        const isRevoked = link.status === "revoked" || link.status === "expired";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  setRegenTarget({ id: link.id, topic: link.topic })
                }
                disabled={isRevoked}
              >
                <RotateCw className="mr-2 h-4 w-4" />
                Regenerate link
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/interview/links/${link.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View detail
                </Link>
              </DropdownMenuItem>
              {canRevoke && !isRevoked && (
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10"
                  onClick={() => setSingleRevokingId(link.id)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Revoke
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    });

    return cols;
  }, [displaySettings, canRevoke]);

  const isEmpty = !isLoading && filteredLinks.length === 0;

  if (isEmpty && !searchQuery) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={Link2}
          title="No share links yet"
          description="Create your first share link to start inviting guests for AI interviews."
          action={{
            label: "Create share link",
            onClick: () => setQuickCreateOpen(true),
          }}
        />
        <QuickCreateDialog
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          onMoreOptions={(topic) => {
            setTopicPass(topic);
            setFullCreateOpen(true);
          }}
        />
        <ShareLinkDialog
          open={fullCreateOpen}
          onOpenChange={setFullCreateOpen}
          initialTopic={pendingTopic}
        />
      </div>
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
              groupingOptions={TABLE_GROUPING_OPTIONS}
              orderingOptions={TABLE_ORDERING_OPTIONS}
              displayProperties={TABLE_DISPLAY_PROPERTIES}
              defaultSettings={TABLE_DEFAULT_SETTINGS}
            />
            <ExpandableSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by topic..."
            />
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setQuickCreateOpen(true)}>
              <Plus className="size-3.5" />
              Create Link
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <DataTable
          data={filteredLinks}
          columns={columns}
          getRowId={(row) => row.id}
          enableSorting
          enableRowSelection
          onSelectionChange={setSelectedItems}
          sorting={sorting}
          onSortingChange={setSorting}
          tableId="share-links-table"
          emptyMessage={isLoading ? "Loading links..." : "No links match search filter."}
        />
      </div>

      {/* Quick Create Dialog */}
      <QuickCreateDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onMoreOptions={(topic) => {
          setTopicPass(topic);
          setFullCreateOpen(true);
        }}
      />

      {/* Full Share Link Dialog */}
      <ShareLinkDialog
        open={fullCreateOpen}
        onOpenChange={setFullCreateOpen}
        initialTopic={pendingTopic}
      />

      {/* Bulk actions bar */}
      <BottomBulkActionsBar
        count={selectedItems.length}
        onClear={() => setSelectedItems([])}
        onActionsClick={() => setBulkConfirmOpen(true)}
        itemNameSingular="share link"
        itemNamePlural="share links"
      />

      {/* Bulk Revoke Dialog */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title="Revoke Share Links"
        description={`Are you sure you want to revoke ${selectedItems.length} selected share link${selectedItems.length === 1 ? "" : "s"}? Guests will no longer be able to use them to start interviews.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleBulkRevoke}
        loading={revokeLink.isPending}
      />

      {/* Single Revoke Dialog */}
      <ConfirmDialog
        open={!!singleRevokingId}
        onOpenChange={(open) => !open && setSingleRevokingId(null)}
        title="Revoke Share Link"
        description="Are you sure you want to revoke this share link? Guests will no longer be able to use it to start interviews. This action cannot be undone."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevokeSingle}
        loading={revokeLink.isPending}
      />

      {/* Regenerate Dialog (rotate token, show new link + share buttons) */}
      <RegenerateShareLinkDialog
        open={!!regenTarget}
        onOpenChange={(open) => !open && setRegenTarget(null)}
        shareLinkId={regenTarget?.id ?? null}
        topic={regenTarget?.topic ?? null}
      />
    </div>
  );
}
