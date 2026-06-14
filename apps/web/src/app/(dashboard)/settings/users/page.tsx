"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { Button } from "@repo/ui/primitives/button";
import { ExpandableSearch } from "@repo/ui/composites/expandable-search";
import { DisplayPopover } from "@repo/ui/composites/display-popover";
import { UserPlus } from "lucide-react";
import { useDisplaySettings } from "@/hooks/use-display-settings";
import { useDataTableDisplay } from "@/hooks/use-data-table-display";
import { BottomBulkActionsBar } from "@repo/ui/composites/bottom-bulk-actions-bar";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import {
  useUsersQuery,
  useDeleteUsersMutation,
  type AppUser,
} from "@/hooks/use-users-query";
import { useBlogsQuery } from "@/hooks/use-blogs-query";
import { useUserColumns } from "@/components/users/users-columns";
import { UsersContent } from "@/components/users/users-content";
import { InviteMemberDialog } from "@/components/settings/invite-member-dialog";
import { toast } from "sonner";
import {
  USER_GROUPING_OPTIONS,
  USER_ORDERING_OPTIONS,
  USER_DISPLAY_PROPERTIES,
  USER_DEFAULT_SETTINGS,
} from "../../users/constants";

export default function SettingsUsersPage() {
  const { data: users = [], isLoading } = useUsersQuery();
  const { data: blogsResult } = useBlogsQuery();
  const deleteMutation = useDeleteUsersMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<AppUser[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const activeBlogId = blogsResult?.activeBlogId ?? null;

  const [displaySettings, setDisplaySettings] = useDisplaySettings(
    "settings-users-page",
    USER_DEFAULT_SETTINGS,
  );

  const { sorting, columnVisibility, onSortingChange } = useDataTableDisplay(
    displaySettings,
    setDisplaySettings,
    USER_DISPLAY_PROPERTIES,
  );

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync([id]);
        toast.success("User deleted");
        setDeletingId(null);
      } catch {
        toast.error("Failed to delete user");
      }
    },
    [deleteMutation],
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      const ids = selectedUsers.map((u) => u.id);
      await deleteMutation.mutateAsync(ids);
      toast.success(`${ids.length} users deleted`);
      setSelectedUsers([]);
      setDeleteConfirmOpen(false);
    } catch {
      toast.error("Failed to delete users");
    }
  }, [selectedUsers, deleteMutation]);

  const columns = useUserColumns({
    onDelete: setDeletingId,
  });

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Users" },
        ]}
      />

      <TableToolbar
        left={null}
        right={
          <>
            <DisplayPopover
              settings={displaySettings}
              onSettingsChange={setDisplaySettings}
              groupingOptions={USER_GROUPING_OPTIONS}
              orderingOptions={USER_ORDERING_OPTIONS}
              displayProperties={USER_DISPLAY_PROPERTIES}
              defaultSettings={USER_DEFAULT_SETTINGS}
              enableBoardView={false}
            />
            <ExpandableSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search users..."
            />
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setInviteOpen(true)}
              disabled={!activeBlogId}
            >
              <UserPlus className="size-3.5" />
              Invite member
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <UsersContent
          users={filteredUsers}
          loading={isLoading}
          columns={columns}
          sorting={sorting}
          onSortingChange={onSortingChange}
          columnVisibility={columnVisibility}
          onSelectionChange={setSelectedUsers}
          basePath="/settings/users"
        />
      </div>

      <BottomBulkActionsBar
        count={selectedUsers.length}
        onClear={() => setSelectedUsers([])}
        onActionsClick={() => setDeleteConfirmOpen(true)}
        itemNameSingular="user"
        itemNamePlural="users"
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Users"
        description={`Are you sure you want to delete ${selectedUsers.length} user${selectedUsers.length === 1 ? "" : "s"}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleBulkDelete}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deletingId && handleDelete(deletingId)}
        loading={deleteMutation.isPending}
      />

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        blogId={activeBlogId}
      />
    </div>
  );
}
