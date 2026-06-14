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
import { Link2, Plus, Pencil, Trash2 } from "lucide-react";
import type { InternalLinkRule } from "@repo/types";
import {
  useInternalLinkRulesQuery,
  useCreateInternalLinkRuleMutation,
  useUpdateInternalLinkRuleMutation,
  useDeleteInternalLinkRuleMutation,
} from "./hooks/use-internal-links-query";
import { toast } from "sonner";

/* ---------- Form defaults ---------- */

const EMPTY_FORM = {
  keyword: "",
  targetUrl: "",
  maxPerArticle: 2,
};

type FormState = typeof EMPTY_FORM;

function ruleToForm(rule: InternalLinkRule): FormState {
  return {
    keyword: rule.keyword,
    targetUrl: rule.targetUrl,
    maxPerArticle: rule.maxPerArticle,
  };
}

/* ---------- Page ---------- */

export default function InternalLinksPage() {
  const { data: rules = [], isLoading } = useInternalLinkRulesQuery();
  const createMutation = useCreateInternalLinkRuleMutation();
  const updateMutation = useUpdateInternalLinkRuleMutation();
  const deleteMutation = useDeleteInternalLinkRuleMutation();

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

  const openEdit = (rule: InternalLinkRule) => {
    setEditingId(rule.id);
    setForm(ruleToForm(rule));
    setDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.keyword.trim() || !form.targetUrl.trim()) return;

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: editingId, ...form });
        toast.success("Rule updated");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Rule created");
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
      toast.success("Rule deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete rule");
    }
  }, [deleteId, deleteMutation]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "SEO", href: "/seo" },
          { label: "Internal Links" },
        ]}
        actions={
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={openCreate}
          >
            <Plus className="size-3.5" />
            Add Rule
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!isLoading && rules.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No Internal Link Rules"
            description="Internal link rules automatically insert links when a keyword appears in generated content."
          />
        ) : (
          <div className="max-w-3xl space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {rule.keyword}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      max {rule.maxPerArticle}/article
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {rule.targetUrl}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => openEdit(rule)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-error hover:text-error"
                    onClick={() => setDeleteId(rule.id)}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Rule" : "Add Internal Link Rule"}
            </DialogTitle>
            <DialogDescription>
              Define a keyword-to-URL mapping for automatic internal linking.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-keyword">Keyword</Label>
              <Input
                id="rule-keyword"
                placeholder="e.g., content marketing"
                value={form.keyword}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, keyword: e.target.value }))
                }
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-url">Target URL</Label>
              <Input
                id="rule-url"
                placeholder="https://example.com/content-marketing-guide"
                value={form.targetUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, targetUrl: e.target.value }))
                }
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-max">Max Per Article</Label>
              <Input
                id="rule-max"
                type="number"
                min={1}
                max={50}
                value={form.maxPerArticle}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    maxPerArticle: parseInt(e.target.value) || 2,
                  }))
                }
                disabled={isPending}
              />
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
              <Button
                type="submit"
                disabled={
                  !form.keyword.trim() || !form.targetUrl.trim() || isPending
                }
              >
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
        title="Delete Internal Link Rule"
        description="Are you sure you want to delete this rule? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
