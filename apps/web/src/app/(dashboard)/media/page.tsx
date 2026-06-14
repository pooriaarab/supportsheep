"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { Image as ImageIcon, Upload, Trash2, Copy, Check } from "lucide-react";
import {
  useMediaQuery,
  useUploadMediaMutation,
  useDeleteMediaMutation,
  useUpdateMediaAltMutation,
} from "./hooks/use-media-query";
import type { MediaItem } from "@repo/types";
import { toast } from "sonner";
import { cn } from "@repo/ui/utils";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---------- Media Card ---------- */

interface MediaCardProps {
  item: MediaItem;
  onDelete: (id: string) => void;
  onUpdateAlt: (id: string, alt: string) => void;
}

function MediaCard({ item, onDelete, onUpdateAlt }: MediaCardProps) {
  const [editingAlt, setEditingAlt] = useState(false);
  const [altDraft, setAltDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditingAlt = () => {
    setAltDraft(item.alt);
    setEditingAlt(true);
  };

  const handleAltSubmit = () => {
    if (altDraft !== item.alt) {
      onUpdateAlt(item.id, altDraft);
    }
    setEditingAlt(false);
  };

  return (
    <div className="group rounded-lg border bg-card overflow-hidden">
      <div className="relative aspect-video bg-muted">
        <Image
          src={item.url}
          alt={item.alt || item.filename}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          unoptimized
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleCopyUrl}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy URL"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="size-8 p-0"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-xs font-medium text-foreground truncate">
          {item.filename}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatFileSize(item.size)} &middot; {item.mimeType}
        </p>
        {editingAlt ? (
          <Input
            value={altDraft}
            onChange={(e) => setAltDraft(e.target.value)}
            onBlur={handleAltSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleAltSubmit()}
            placeholder="Alt text…"
            className="h-7 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={startEditingAlt}
            className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {item.alt || "Add alt text…"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Drop Zone ---------- */

interface DropZoneProps {
  uploading: boolean;
  onFiles: (files: File[]) => void;
}

function DropZone({ uploading, onFiles }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles(files);
      e.target.value = "";
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border",
        uploading && "opacity-50 pointer-events-none",
      )}
    >
      <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">
        {uploading ? "Uploading…" : "Drag and drop images here, or"}
      </p>
      {!uploading && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => inputRef.current?.click()}
        >
          Choose Files
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

/* ---------- Page ---------- */

export default function MediaPage() {
  const { data: media = [], isLoading } = useMediaQuery();
  const uploadMutation = useUploadMediaMutation();
  const deleteMutation = useDeleteMediaMutation();
  const updateAltMutation = useUpdateMediaAltMutation();

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          await uploadMutation.mutateAsync({ file, alt: "" });
          toast.success(`Uploaded ${file.name}`);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Upload failed";
          toast.error(`${file.name}: ${message}`);
        }
      }
    },
    [uploadMutation],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("Media deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete media");
    }
  }, [deleteId, deleteMutation]);

  const handleUpdateAlt = useCallback(
    (id: string, alt: string) => {
      updateAltMutation.mutate(
        { id, alt },
        {
          onSuccess: () => toast.success("Alt text updated"),
          onError: () => toast.error("Failed to update alt text"),
        },
      );
    },
    [updateAltMutation],
  );

  return (
    <div className="h-full flex flex-col">
      <PageHeader breadcrumbs={[{ label: "Media" }]} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <DropZone uploading={uploadMutation.isPending} onFiles={handleUpload} />

        {!isLoading && media.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="No Media"
            description="Upload images to use in your posts."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {media.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onDelete={setDeleteId}
                onUpdateAlt={handleUpdateAlt}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Media"
        description="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
