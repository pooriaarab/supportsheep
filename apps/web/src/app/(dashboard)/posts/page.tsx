"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/layout/page-header";
import { useDisplaySettings } from "@/hooks/use-display-settings";
import { useDataTableDisplay } from "@/hooks/use-data-table-display";
import { BottomBulkActionsBar } from "@repo/ui/composites/bottom-bulk-actions-bar";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import {
  usePostsQuery,
  useDeletePostsMutation,
  type PostListItem,
} from "./hooks/use-posts-query";
import { usePostColumns } from "./components/posts-columns";
import { PostsToolbar } from "./components/posts-toolbar";
import { PostsContent } from "./components/posts-content";
import { CreatePostDialog } from "./components/create-post-dialog";
import { orderBy } from "@/lib/display-utils";
import { POST_DEFAULT_SETTINGS, POST_DISPLAY_PROPERTIES } from "./constants";
import { toast } from "sonner";
import { useMountEffect } from "@/hooks/use-mount-effect";

function PostsPageContent() {
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const { push } = useRouter();
  const { data: posts = [], isLoading } = usePostsQuery();
  const deleteMutation = useDeletePostsMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosts, setSelectedPosts] = useState<PostListItem[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [displaySettings, setDisplaySettings] = useDisplaySettings(
    "posts-page",
    POST_DEFAULT_SETTINGS,
  );

  const { sorting, columnVisibility, onSortingChange } = useDataTableDisplay(
    displaySettings,
    setDisplaySettings,
    POST_DISPLAY_PROPERTIES,
  );

  // Open create dialog when ?new=true is in the URL
  useMountEffect(() => {
    if (getSearchParam("new") === "true") {
      setCreateOpen(true);
    }
  });

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((post) =>
        post.title.toLowerCase().includes(query),
      );
    }
    return orderBy(
      result,
      displaySettings.ordering,
      displaySettings.orderDirection,
    );
  }, [
    posts,
    searchQuery,
    displaySettings.ordering,
    displaySettings.orderDirection,
  ]);

  const handlePostClick = useCallback(
    (post: PostListItem) => {
      push(`/posts/${encodeURIComponent(post.slug)}/edit`);
    },
    [push],
  );

  const handleDelete = useCallback(
    async (slug: string) => {
      try {
        await deleteMutation.mutateAsync([slug]);
        toast.success("Post deleted");
        setDeletingSlug(null);
      } catch {
        toast.error("Failed to delete post");
      }
    },
    [deleteMutation],
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      const slugs = selectedPosts.map((post) => post.slug);
      await deleteMutation.mutateAsync(slugs);
      toast.success(
        `${slugs.length} post${slugs.length === 1 ? "" : "s"} deleted`,
      );
      setSelectedPosts([]);
      setDeleteConfirmOpen(false);
    } catch {
      toast.error("Failed to delete posts");
    }
  }, [selectedPosts, deleteMutation]);

  const columns = usePostColumns({
    onDelete: setDeletingSlug,
  });

  return (
    <div className="h-full flex flex-col">
      <PageHeader breadcrumbs={[{ label: "Articles" }]} />

      <PostsToolbar
        displaySettings={displaySettings}
        onDisplaySettingsChange={setDisplaySettings}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewPost={() => setCreateOpen(true)}
      />

      <div className="flex-1 overflow-y-auto">
        <PostsContent
          posts={filteredPosts}
          loading={isLoading}
          columns={columns}
          sorting={sorting}
          onSortingChange={onSortingChange}
          columnVisibility={columnVisibility}
          onSelectionChange={setSelectedPosts}
          onPostClick={handlePostClick}
          onNewPost={() => setCreateOpen(true)}
        />
      </div>

      {/* Bulk Actions */}
      <BottomBulkActionsBar
        count={selectedPosts.length}
        onClear={() => setSelectedPosts([])}
        onActionsClick={() => setDeleteConfirmOpen(true)}
        itemNameSingular="POST"
        itemNamePlural="Articles"
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Posts"
        description={`Are you sure you want to delete ${selectedPosts.length} post${selectedPosts.length === 1 ? "" : "s"}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleBulkDelete}
        loading={deleteMutation.isPending}
      />

      {/* Single Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingSlug}
        onOpenChange={(open) => !open && setDeletingSlug(null)}
        title="Delete Post"
        description="Are you sure you want to delete this post? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deletingSlug && handleDelete(deletingSlug)}
        loading={deleteMutation.isPending}
      />

      {/* Create Dialog */}
      <CreatePostDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <PostsPageContent />
    </Suspense>
  );
}
