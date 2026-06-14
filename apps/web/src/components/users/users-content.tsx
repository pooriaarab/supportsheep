"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-display/data-table";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { Users } from "lucide-react";
import type { AppUser } from "@/hooks/use-users-query";

interface UsersContentProps {
  users: AppUser[];
  loading: boolean;
  columns: ColumnDef<AppUser>[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  columnVisibility: Record<string, boolean>;
  onSelectionChange: (users: AppUser[]) => void;
  basePath?: string;
}

export function UsersContent({
  users,
  loading,
  columns,
  sorting,
  onSortingChange,
  columnVisibility,
  onSelectionChange,
  basePath = "/users",
}: UsersContentProps) {
  const { push } = useRouter();

  const navigateToUser = useCallback(
    (row: AppUser) => {
      push(`${basePath}/${encodeURIComponent(row.id)}`);
    },
    [push, basePath],
  );

  return (
    <DataTable
      data={users}
      columns={columns}
      getRowId={(row) => row.id}
      enableSorting
      enableRowSelection
      enableVirtualization
      estimatedRowHeight={60}
      onRowClick={navigateToUser}
      onSelectionChange={onSelectionChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      tableId="users-table"
      initialSettings={{ columnVisibility }}
      emptyMessage={loading ? "Loading users..." : "No users found"}
      emptyState={
        !loading && users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Users"
            description="No users have been added yet. Invite your first team member to get started."
          />
        ) : undefined
      }
    />
  );
}
