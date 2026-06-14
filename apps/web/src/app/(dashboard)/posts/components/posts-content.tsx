"use client";

import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-display/data-table";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { FileText } from "lucide-react";
import type { PostListItem } from "../hooks/use-posts-query";

interface PostsContentProps {
  posts: PostListItem[];
  loading: boolean;
  columns: ColumnDef<PostListItem>[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  columnVisibility: Record<string, boolean>;
  onSelectionChange: (items: PostListItem[]) => void;
  onPostClick: (post: PostListItem) => void;
  onNewPost: () => void;
}

export function PostsContent({
  posts,
  loading,
  columns,
  sorting,
  onSortingChange,
  columnVisibility,
  onSelectionChange,
  onPostClick,
  onNewPost,
}: PostsContentProps) {
  const isEmpty = !loading && posts.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        icon={FileText}
        title="No Posts Yet"
        description="Create your first post to start publishing."
        action={{ label: "New Post", onClick: onNewPost }}
      />
    );
  }

  return (
    <DataTable
      data={posts}
      columns={columns}
      getRowId={(row) => row.slug}
      enableSorting
      enableRowSelection
      enableVirtualization
      estimatedRowHeight={53}
      onRowClick={onPostClick}
      onSelectionChange={onSelectionChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      tableId="posts-table"
      initialSettings={{ columnVisibility }}
      emptyMessage={loading ? "Loading posts..." : "No posts found"}
    />
  );
}
