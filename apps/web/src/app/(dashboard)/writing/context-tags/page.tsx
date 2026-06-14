"use client";

import { useState, useCallback } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Textarea } from "@repo/ui/primitives/textarea";
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
import { Tags, Plus, Pencil, Trash2 } from "lucide-react";
import type { ContextTag } from "@repo/types";
import {
  useContextTagsQuery,
  useCreateContextTagMutation,
  useUpdateContextTagMutation,
  useDeleteContextTagMutation,
} from "./hooks/use-context-tags-query";
import { toast } from "sonner";

/* ---------- Form defaults ---------- */

const EMPTY_FORM = {
  name: "",
  targetAudience: "",
  tone: "professional",
  style: "informative",
  language: "English",
  articleLengthMin: 1000,
  articleLengthMax: 2000,
  ctaText: "",
  ctaUrl: "",
  customPrompt: "",
  imageStyle: "realistic",
  imageColorScheme: "",
  imageCount: 3,
  imageAspectRatio: "16:9",
};

type FormState = typeof EMPTY_FORM;

function formToPayload(f: FormState) {
  return {
    name: f.name,
    targetAudience: f.targetAudience,
    tone: f.tone,
    style: f.style,
    language: f.language,
    articleLength: { min: f.articleLengthMin, max: f.articleLengthMax },
    cta: { text: f.ctaText, url: f.ctaUrl },
    customPrompt: f.customPrompt,
    imageSettings: {
      style: f.imageStyle,
      colorScheme: f.imageColorScheme,
      count: f.imageCount,
      aspectRatio: f.imageAspectRatio,
    },
  };
}

function tagToForm(tag: ContextTag): FormState {
  return {
    name: tag.name,
    targetAudience: tag.targetAudience,
    tone: tag.tone,
    style: tag.style,
    language: tag.language,
    articleLengthMin: tag.articleLength?.min ?? 1000,
    articleLengthMax: tag.articleLength?.max ?? 2000,
    ctaText: tag.cta?.text ?? "",
    ctaUrl: tag.cta?.url ?? "",
    customPrompt: tag.customPrompt,
    imageStyle: tag.imageSettings?.style ?? "realistic",
    imageColorScheme: tag.imageSettings?.colorScheme ?? "",
    imageCount: tag.imageSettings?.count ?? 3,
    imageAspectRatio: tag.imageSettings?.aspectRatio ?? "16:9",
  };
}

/* ---------- Page ---------- */

export default function ContextTagsPage() {
  const { data: tags = [], isLoading } = useContextTagsQuery();
  const createMutation = useCreateContextTagMutation();
  const updateMutation = useUpdateContextTagMutation();
  const deleteMutation = useDeleteContextTagMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const isEditing = !!editingId;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (tag: ContextTag) => {
    setEditingId(tag.id);
    setForm(tagToForm(tag));
    setDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...formToPayload(form),
        });
        toast.success("Context tag updated");
      } else {
        await createMutation.mutateAsync(formToPayload(form));
        toast.success("Context tag created");
      }
      setDialogOpen(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Operation failed";
      toast.error(message);
    }
  };

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("Context tag deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete context tag");
    }
  }, [deleteId, deleteMutation]);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Writing", href: "/writing" },
          { label: "Context Tags" },
        ]}
        actions={
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={openCreate}
          >
            <Plus className="size-3.5" />
            Add Context Tag
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!isLoading && tags.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No Context Tags"
            description="Context tags define your brand voice. Create one to control tone, style, and audience for generated content."
          />
        ) : (
          <div className="max-w-3xl space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {tag.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tag.tone} / {tag.style}
                    </span>
                  </div>
                  {tag.targetAudience && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      Audience: {tag.targetAudience}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{tag.language}</span>
                    <span>
                      {tag.articleLength?.min}-{tag.articleLength?.max} words
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => openEdit(tag)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-error hover:text-error"
                    onClick={() => setDeleteId(tag.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Context Tag" : "Add Context Tag"}
            </DialogTitle>
            <DialogDescription>
              Define a brand voice profile for AI-generated content.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ct-name">Name</Label>
              <Input
                id="ct-name"
                placeholder="e.g., Corporate Blog"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-audience">Target Audience</Label>
              <Input
                id="ct-audience"
                placeholder="e.g., SaaS founders and product managers"
                value={form.targetAudience}
                onChange={(e) => updateField("targetAudience", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ct-tone">Tone</Label>
                <Input
                  id="ct-tone"
                  placeholder="professional"
                  value={form.tone}
                  onChange={(e) => updateField("tone", e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ct-style">Style</Label>
                <Input
                  id="ct-style"
                  placeholder="informative"
                  value={form.style}
                  onChange={(e) => updateField("style", e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-language">Language</Label>
              <Input
                id="ct-language"
                placeholder="English"
                value={form.language}
                onChange={(e) => updateField("language", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ct-len-min">Min Words</Label>
                <Input
                  id="ct-len-min"
                  type="number"
                  value={form.articleLengthMin}
                  onChange={(e) =>
                    updateField(
                      "articleLengthMin",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ct-len-max">Max Words</Label>
                <Input
                  id="ct-len-max"
                  type="number"
                  value={form.articleLengthMax}
                  onChange={(e) =>
                    updateField(
                      "articleLengthMax",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ct-cta-text">CTA Text</Label>
                <Input
                  id="ct-cta-text"
                  placeholder="Try it free"
                  value={form.ctaText}
                  onChange={(e) => updateField("ctaText", e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ct-cta-url">CTA URL</Label>
                <Input
                  id="ct-cta-url"
                  placeholder="https://..."
                  value={form.ctaUrl}
                  onChange={(e) => updateField("ctaUrl", e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-prompt">Custom Prompt (optional)</Label>
              <Textarea
                id="ct-prompt"
                placeholder="Additional instructions for the AI..."
                value={form.customPrompt}
                onChange={(e) => updateField("customPrompt", e.target.value)}
                disabled={isPending}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Image Settings
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Style (realistic)"
                  value={form.imageStyle}
                  onChange={(e) => updateField("imageStyle", e.target.value)}
                  disabled={isPending}
                />
                <Input
                  placeholder="Color scheme"
                  value={form.imageColorScheme}
                  onChange={(e) =>
                    updateField("imageColorScheme", e.target.value)
                  }
                  disabled={isPending}
                />
                <Input
                  type="number"
                  placeholder="Count"
                  value={form.imageCount}
                  onChange={(e) =>
                    updateField("imageCount", parseInt(e.target.value) || 0)
                  }
                  disabled={isPending}
                />
                <Input
                  placeholder="Aspect ratio (16:9)"
                  value={form.imageAspectRatio}
                  onChange={(e) =>
                    updateField("imageAspectRatio", e.target.value)
                  }
                  disabled={isPending}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!form.name.trim() || isPending}>
                {isPending
                  ? isEditing
                    ? "Saving..."
                    : "Creating..."
                  : isEditing
                    ? "Save"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Context Tag"
        description="Are you sure you want to delete this context tag? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
