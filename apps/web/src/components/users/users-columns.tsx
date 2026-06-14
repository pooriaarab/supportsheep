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
import { MoreVertical, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@repo/ui/composites/status-badge";
import type { AppUser } from "@/hooks/use-users-query";

interface UseUserColumnsOptions {
  onDelete: (id: string) => void;
}

const roleBadgeVariant: Record<AppUser["role"], "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "default",
  editor: "secondary",
  member: "secondary",
  viewer: "outline",
  guest: "outline",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function useUserColumns({ onDelete }: UseUserColumnsOptions) {
  return useMemo<ColumnDef<AppUser>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          // Older user docs (and any synthesized via DEV_AUTH_BYPASS) only
          // have `email` — guard the avatar initials so a missing `name`
          // doesn't crash the whole users table with a `.split` TypeError.
          const displayName =
            row.original.name ?? row.original.email?.split("@")[0] ?? "";
          const initials = displayName
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          return (
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-muted-foreground">
                  {initials || "—"}
                </span>
              </div>
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">
                  {displayName || row.original.email || "Unknown user"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {row.original.email}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge variant={roleBadgeVariant[row.original.role]}>
            {row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "joinedAt",
        header: "Joined",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.joinedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
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
                <Pencil className="size-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <ShieldCheck className="size-3.5 mr-2" />
                Change Role
              </DropdownMenuItem>
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
        enableSorting: false,
        enableHiding: false,
        size: 48,
      },
    ],
    [onDelete],
  );
}
