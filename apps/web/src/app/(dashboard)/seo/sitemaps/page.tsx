"use client";

import { useState, useCallback } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/primitives/dialog";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { Map, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  useSitemapsQuery,
  useCreateSitemapMutation,
  useRefreshSitemapMutation,
  useDeleteSitemapMutation,
} from "./hooks/use-sitemaps-query";
import { toast } from "sonner";

/* ---------- Page ---------- */

export default function SitemapsPage() {
  const { data: sitemaps = [], isLoading } = useSitemapsQuery();
  const createMutation = useCreateSitemapMutation();
  const refreshMutation = useRefreshSitemapMutation();
  const deleteMutation = useDeleteSitemapMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      const result = await createMutation.mutateAsync(url.trim());
      toast.success(`Sitemap imported: ${result.urlCount} URLs found`);
      setAddOpen(false);
      setUrl("");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to import sitemap";
      toast.error(message);
    }
  };

  const handleRefresh = useCallback(
    async (id: string) => {
      try {
        const result = await refreshMutation.mutateAsync(id);
        toast.success(`Sitemap refreshed: ${result.urlCount} URLs found`);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to refresh sitemap";
        toast.error(message);
      }
    },
    [refreshMutation],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("Sitemap deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete sitemap");
    }
  }, [deleteId, deleteMutation]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[{ label: "SEO", href: "/seo" }, { label: "Sitemaps" }]}
        actions={
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3.5" />
            Add Sitemap
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!isLoading && sitemaps.length === 0 ? (
          <EmptyState
            icon={Map}
            title="No Sitemaps"
            description="Import a sitemap to provide URLs for internal linking suggestions."
          />
        ) : (
          <div className="max-w-3xl space-y-2">
            {sitemaps.map((sitemap) => (
              <div
                key={sitemap.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {sitemap.url}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>
                      {sitemap.urlCount ?? sitemap.urls?.length ?? 0} URLs
                    </span>
                    {sitemap.lastFetched && (
                      <span>
                        Last fetched:{" "}
                        {typeof sitemap.lastFetched === "string"
                          ? new Date(sitemap.lastFetched).toLocaleDateString()
                          : "Recently"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => handleRefresh(sitemap.id)}
                    disabled={refreshMutation.isPending}
                    title="Refresh sitemap"
                  >
                    <RefreshCw
                      className={`size-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-error hover:text-error"
                    onClick={() => setDeleteId(sitemap.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Sitemap Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sitemap</DialogTitle>
            <DialogDescription>
              Enter a sitemap URL to fetch and parse. Supports standard XML
              sitemaps and sitemap index files.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sitemap-url">Sitemap URL</Label>
              <Input
                id="sitemap-url"
                placeholder="https://example.com/sitemap.xml"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={createMutation.isPending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!url.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Importing..." : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Sitemap"
        description="Are you sure you want to delete this sitemap? The URLs will no longer be available for internal linking."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
