"use client";

import { useState, useCallback } from "react";
import type { FormEvent } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { FolderOpen, GripVertical, Plus, Pencil, Trash2 } from "lucide-react";
import {
  useCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useReorderCategoriesMutation,
  type CategoryItem,
} from "./hooks/use-categories-query";
import { toast } from "sonner";

/* ---------- Sortable Category Card ---------- */

interface SortableCategoryCardProps {
  category: CategoryItem;
  onEdit: (category: CategoryItem) => void;
  onDelete: (slug: string) => void;
}

function SortableCategoryCard({
  category,
  onEdit,
  onDelete,
}: SortableCategoryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-4"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {category.icon && <span className="text-base">{category.icon}</span>}
          <span className="font-medium text-sm text-foreground">
            {category.displayName}
          </span>
          <span className="text-xs text-muted-foreground">
            ({category.postCount} posts)
          </span>
        </div>
        {category.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {category.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => onEdit(category)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-error hover:text-error"
          onClick={() => onDelete(category.slug)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategoriesQuery();
  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();
  const reorderMutation = useReorderCategoriesMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryItem | null>(null);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [orderedCategories, setOrderedCategories] = useState<
    CategoryItem[] | null
  >(null);

  // Form state (create)
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // Form state (edit)
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const displayCategories = orderedCategories ?? categories;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const items = [...displayCategories];
      const oldIndex = items.findIndex((c) => c.slug === active.id);
      const newIndex = items.findIndex((c) => c.slug === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      setOrderedCategories(reordered);

      // Persist new order
      const orderMap: Record<string, number> = {};
      reordered.forEach((cat, index) => {
        orderMap[cat.slug] = index;
      });

      reorderMutation.mutate(orderMap, {
        onError: () => {
          setOrderedCategories(null);
          toast.error("Failed to reorder categories");
        },
      });
    },
    [displayCategories, reorderMutation],
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) return;

    try {
      await createMutation.mutateAsync({
        slug: formSlug.trim(),
        displayName: formName.trim(),
        icon: formIcon.trim(),
        description: formDescription.trim(),
      });
      toast.success("Category created");
      setCreateOpen(false);
      setFormName("");
      setFormSlug("");
      setFormIcon("");
      setFormDescription("");
      setOrderedCategories(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create category";
      toast.error(message);
    }
  };

  const handleDelete = useCallback(async () => {
    if (!deleteSlug) return;
    try {
      await deleteMutation.mutateAsync(deleteSlug);
      toast.success("Category deleted");
      setDeleteSlug(null);
      setOrderedCategories(null);
    } catch {
      toast.error("Failed to delete category");
    }
  }, [deleteSlug, deleteMutation]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormName(name);
    setFormSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  const openEditDialog = useCallback((category: CategoryItem) => {
    setEditCategory(category);
    setEditName(category.displayName);
    setEditIcon(category.icon);
    setEditDescription(category.description);
  }, []);

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editCategory || !editName.trim()) return;

    try {
      await updateMutation.mutateAsync({
        slug: editCategory.slug,
        displayName: editName.trim(),
        icon: editIcon.trim(),
        description: editDescription.trim(),
      });
      toast.success("Category updated");
      setEditCategory(null);
      setOrderedCategories(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update category";
      toast.error(message);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[{ label: "Categories" }]}
        actions={
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            Add Category
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!isLoading && displayCategories.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No Categories"
            description="Create your first category to organize your posts."
          />
        ) : (
          <div className="max-w-2xl space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayCategories.map((c) => c.slug)}
                strategy={verticalListSortingStrategy}
              >
                {displayCategories.map((category) => (
                  <SortableCategoryCard
                    key={category.slug}
                    category={category}
                    onEdit={openEditDialog}
                    onDelete={setDeleteSlug}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Create Category Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a new category to organize posts.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                placeholder="e.g., Technology"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                placeholder="e.g., technology"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-icon">Icon (emoji)</Label>
              <Input
                id="cat-icon"
                placeholder="e.g., 💻"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description (optional)</Label>
              <Textarea
                id="cat-desc"
                placeholder="Brief description of this category..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                disabled={createMutation.isPending}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !formName.trim() ||
                  !formSlug.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={!!editCategory}
        onOpenChange={(open) => !open && setEditCategory(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category name, icon, or description.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-cat-name">Name</Label>
              <Input
                id="edit-cat-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cat-icon">Icon (emoji)</Label>
              <Input
                id="edit-cat-icon"
                placeholder="e.g., 💻"
                value={editIcon}
                onChange={(e) => setEditIcon(e.target.value)}
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cat-desc">Description (optional)</Label>
              <Textarea
                id="edit-cat-desc"
                placeholder="Brief description of this category..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={updateMutation.isPending}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCategory(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editName.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteSlug}
        onOpenChange={(open) => !open && setDeleteSlug(null)}
        title="Delete Category"
        description="Are you sure you want to delete this category? Posts in this category will not be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
