"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@repo/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import { MoreVertical, Pencil, Trash2, ExternalLink } from "lucide-react";
import { StatusBadge } from "@repo/ui/composites/status-badge";
import { getIndexNowStatusLabel } from "@/lib/seo/submission-status";
import type { PostListItem } from "../hooks/use-posts-query";

interface UsePostColumnsOptions {
  onDelete: (slug: string) => void;
}

function relativeTime(value: unknown): string {
  if (!value) return "-";
  let date: Date;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    date = (value as { toDate: () => Date }).toDate();
  } else {
    date = new Date(value as string);
  }
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

function formatPostType(postType: string): string {
  return postType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function usePostColumns({ onDelete }: UsePostColumnsOptions) {
  return useMemo<ColumnDef<PostListItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <Link
            href={`/posts/${encodeURIComponent(row.original.slug)}/edit`}
            className="font-medium text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "featuredImage",
        header: "Image",
        cell: ({ row }) => {
          const img = row.original.featuredImage;
          const url =
            typeof img === "object" && img !== null
              ? (img as { url: string }).url
              : typeof img === "string"
                ? img
                : null;
          if (!url) return <div className="w-10 h-7 rounded bg-muted" />;
          return (
            <Image
              src={url}
              alt=""
              width={40}
              height={28}
              unoptimized
              className="w-10 h-7 object-cover rounded"
            />
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "indexNow",
        header: "IndexNow",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {getIndexNowStatusLabel(
              row.original.submissionStatus?.indexNow?.status,
            )}
          </span>
        ),
      },
      {
        accessorKey: "postType",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatPostType(row.original.postType)}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground capitalize">
            {row.original.category || "-"}
          </span>
        ),
      },
      {
        accessorKey: "seoScore",
        header: "SEO",
        cell: ({ row }) => {
          const score = row.original.seoScore;
          const color =
            score >= 80
              ? "bg-success"
              : score >= 50
                ? "bg-warning"
                : "bg-muted-foreground/30";
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {score}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {relativeTime(row.original.updatedAt)}
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
              <DropdownMenuItem asChild>
                <Link
                  href={`/posts/${encodeURIComponent(row.original.slug)}/edit`}
                >
                  <Pencil className="size-3.5 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {row.original.status === "published" && (
                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="size-3.5 mr-2" />
                  View live
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(row.original.slug);
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
