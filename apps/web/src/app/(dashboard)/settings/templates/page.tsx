"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Badge } from "@repo/ui/primitives/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/primitives/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import { EmptyState } from "@repo/ui/composites/empty-state";
import {
  Plus,
  ClipboardList,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: number;
  usageCount: number;
}

async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch("/api/v1/templates");
  if (!res.ok) throw new Error("Failed to fetch templates");
  const json = await res.json();
  return json.data;
}

async function createTemplate(data: {
  name: string;
  description: string;
  category?: string;
}): Promise<Template> {
  const res = await fetch("/api/v1/templates", {
    method: "Article",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create template");
  return res.json();
}

async function duplicateTemplate(
  template: Template,
): Promise<Template> {
  const res = await fetch("/api/v1/templates", {
    method: "Article",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${template.name} (Copy)`,
      description: template.description,
      category: template.category,
      fields: template.fields,
    }),
  });
  if (!res.ok) throw new Error("Failed to duplicate template");
  return res.json();
}

async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch("/api/v1/templates", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to delete template");
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: queryKeys.templates.lists(),
    queryFn: fetchTemplates,
  });

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success(`Template "${newName}" created`);
      setNewName("");
      setNewDescription("");
      setCreateOpen(false);
    },
    onError: () => {
      toast.error("Failed to create template");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success(`Template "${data.name}" duplicated`);
    },
    onError: () => {
      toast.error("Failed to duplicate template");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      toast.success("Template deleted");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      description: newDescription.trim(),
    });
  }, [newName, newDescription, createMutation]);

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
  }, [deleteId, deleteMutation]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader
          breadcrumbs={[
            { label: "Settings", href: "/settings" },
            { label: "Templates" },
          ]}
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Templates" },
        ]}
        actions={
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            New Template
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          {templates.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No Templates"
              description="Create templates to standardize how your team creates items and tasks."
              action={{
                label: "Create Template",
                onClick: () => setCreateOpen(true),
              }}
            />
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="p-5 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        {template.name}
                      </h4>
                      <Badge variant="secondary" className="text-[10px]">
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{template.fields} fields</span>
                      <span>Used {template.usageCount} times</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-8 p-0">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pencil className="size-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => duplicateMutation.mutate(template)}
                      >
                        <Copy className="size-3.5 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-error focus:text-error"
                        onClick={() => setDeleteId(template.id)}
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>
              Templates help standardize how your team creates content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Bug Report"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-desc">Description</Label>
              <Textarea
                id="template-desc"
                placeholder="What is this template for?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Template"
        description="This template will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
