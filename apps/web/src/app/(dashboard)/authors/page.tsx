"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { ExternalLink, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
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
import type { Author } from "@repo/types";
import {
  useAuthorsQuery,
  useCreateAuthorMutation,
  useDeleteAuthorMutation,
  useUpdateAuthorMutation,
} from "./hooks/use-authors-query";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseSameAs(value: string): string[] {
  return value
    .split(/\n|,/)
    .flatMap((entry) => {
      const trimmedEntry = entry.trim();
      return trimmedEntry ? [trimmedEntry] : [];
    });
}

interface FormState {
  name: string;
  slug: string;
  jobTitle: string;
  bio: string;
  avatarUrl: string;
  email: string;
  sameAs: string;
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  jobTitle: "",
  bio: "",
  avatarUrl: "",
  email: "",
  sameAs: "",
};

function authorToFormState(author: Author): FormState {
  return {
    name: author.name,
    slug: author.id,
    jobTitle: author.jobTitle ?? "",
    bio: author.bio,
    avatarUrl: author.avatarUrl ?? "",
    email: author.email ?? "",
    sameAs: (author.sameAs ?? []).join("\n"),
  };
}

export default function AuthorsPage() {
  const { data: authors = [], isLoading } = useAuthorsQuery();
  const createMutation = useCreateAuthorMutation();
  const updateMutation = useUpdateAuthorMutation();
  const deleteMutation = useDeleteAuthorMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [editAuthor, setEditAuthor] = useState<Author | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const openEditDialog = (author: Author) => {
    setEditAuthor(author);
    setEditForm(authorToFormState(author));
  };

  const handleCreateNameChange = (value: string) => {
    setCreateForm((prev) => ({ ...prev, name: value, slug: slugify(value) }));
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.slug.trim()) return;

    try {
      await createMutation.mutateAsync({
        id: createForm.slug.trim(),
        name: createForm.name.trim(),
        jobTitle: createForm.jobTitle.trim() || undefined,
        bio: createForm.bio.trim(),
        avatarUrl: createForm.avatarUrl.trim() || undefined,
        email: createForm.email.trim() || undefined,
        sameAs: parseSameAs(createForm.sameAs),
      });
      toast.success("Author created");
      setCreateOpen(false);
      setCreateForm(emptyForm);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create author";
      toast.error(message);
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editAuthor || !editForm.name.trim()) return;

    try {
      await updateMutation.mutateAsync({
        id: editAuthor.id,
        name: editForm.name.trim(),
        jobTitle: editForm.jobTitle.trim() || undefined,
        bio: editForm.bio.trim(),
        avatarUrl: editForm.avatarUrl.trim() || undefined,
        email: editForm.email.trim() || undefined,
        sameAs: parseSameAs(editForm.sameAs),
      });
      toast.success("Author updated");
      setEditAuthor(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update author";
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("Author deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete author");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumbs={[{ label: "Authors" }]}
        actions={
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            Add Author
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!isLoading && authors.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No Authors"
            description="Create your first author to enable named bylines and rich Person schema on articles."
          />
        ) : (
          <div className="max-w-3xl space-y-2">
            {authors.map((author) => (
              <div
                key={author.id}
                className="flex items-start gap-4 rounded-lg border bg-card p-4"
              >
                {author.avatarUrl ? (
                  <Image
                    src={author.avatarUrl}
                    alt={`${author.name} avatar`}
                    width={40}
                    height={40}
                    unoptimized
                    className="size-10 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="size-4" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {author.name}
                    </span>
                    <a
                      href={`/authors/${author.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      /authors/{author.id}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  {author.jobTitle ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {author.jobTitle}
                    </p>
                  ) : null}
                  {author.bio ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {author.bio}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => openEditDialog(author)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-error hover:text-error"
                    onClick={() => setDeleteId(author.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Author</DialogTitle>
            <DialogDescription>
              Named authors unlock rich Person schema on articles and a
              dedicated archive page at /authors/{"{slug}"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="author-name">Name</Label>
              <Input
                id="author-name"
                placeholder="e.g., Jane Doe"
                value={createForm.name}
                onChange={(e) => handleCreateNameChange(e.target.value)}
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-slug">Slug</Label>
              <Input
                id="author-slug"
                placeholder="e.g., jane-doe"
                value={createForm.slug}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, slug: e.target.value }))
                }
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-job">Job title</Label>
              <Input
                id="author-job"
                placeholder="e.g., Senior Product Manager"
                value={createForm.jobTitle}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    jobTitle: e.target.value,
                  }))
                }
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-bio">Bio</Label>
              <Textarea
                id="author-bio"
                placeholder="Short biography visible on the author page..."
                value={createForm.bio}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, bio: e.target.value }))
                }
                disabled={createMutation.isPending}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-avatar">Avatar URL</Label>
              <Input
                id="author-avatar"
                placeholder="https://..."
                value={createForm.avatarUrl}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    avatarUrl: e.target.value,
                  }))
                }
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-email">Email</Label>
              <Input
                id="author-email"
                type="email"
                placeholder="name@example.com"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-sameas">
                Profile links (one per line or comma-separated)
              </Label>
              <Textarea
                id="author-sameas"
                placeholder={
                  "https://www.linkedin.com/in/jane-doe\nhttps://github.com/jane"
                }
                value={createForm.sameAs}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, sameAs: e.target.value }))
                }
                disabled={createMutation.isPending}
                rows={3}
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
                  !createForm.name.trim() ||
                  !createForm.slug.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editAuthor}
        onOpenChange={(open) => !open && setEditAuthor(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Author</DialogTitle>
            <DialogDescription>
              Update the author profile. The slug cannot be changed after
              creation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-author-name">Name</Label>
              <Input
                id="edit-author-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-author-job">Job title</Label>
              <Input
                id="edit-author-job"
                value={editForm.jobTitle}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    jobTitle: e.target.value,
                  }))
                }
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-author-bio">Bio</Label>
              <Textarea
                id="edit-author-bio"
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, bio: e.target.value }))
                }
                disabled={updateMutation.isPending}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-author-avatar">Avatar URL</Label>
              <Input
                id="edit-author-avatar"
                value={editForm.avatarUrl}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    avatarUrl: e.target.value,
                  }))
                }
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-author-email">Email</Label>
              <Input
                id="edit-author-email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, email: e.target.value }))
                }
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-author-sameas">
                Profile links (one per line or comma-separated)
              </Label>
              <Textarea
                id="edit-author-sameas"
                value={editForm.sameAs}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, sameAs: e.target.value }))
                }
                disabled={updateMutation.isPending}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditAuthor(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editForm.name.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Author"
        description="Are you sure you want to delete this author? Articles referencing this author by id will fall back to the legacy author string."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
