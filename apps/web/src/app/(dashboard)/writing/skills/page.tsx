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
import { Switch } from "@repo/ui/primitives/switch";
import { Badge } from "@repo/ui/primitives/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
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
import { Wand2, Plus, Pencil, Trash2, GripVertical, Play } from "lucide-react";
import type { WritingSkill } from "@repo/types";
import {
  useWritingSkillsQuery,
  useCreateWritingSkillMutation,
  useUpdateWritingSkillMutation,
  useDeleteWritingSkillMutation,
  useReorderWritingSkillsMutation,
  useRunSkillsPipelineMutation,
} from "./hooks/use-writing-skills-query";
import { toast } from "sonner";

/* ---------- Form defaults ---------- */

interface FormState {
  name: string;
  description: string;
  prompt: string;
  provider: "claude" | "gpt" | "gemini";
  model: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  prompt: "",
  provider: "claude",
  model: "",
  enabled: true,
};

/* ---------- Sortable Skill Card ---------- */

interface SortableSkillCardProps {
  skill: WritingSkill;
  onEdit: (skill: WritingSkill) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onTest: (skill: WritingSkill) => void;
}

function SortableSkillCard({
  skill,
  onEdit,
  onDelete,
  onToggle,
  onTest,
}: SortableSkillCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: skill.id });

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
          <span className="font-medium text-sm text-foreground">
            {skill.name}
          </span>
          <Badge variant={skill.type === "builtin" ? "secondary" : "outline"}>
            {skill.type}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {skill.provider}
          </span>
        </div>
        {skill.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {skill.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={skill.enabled}
          onCheckedChange={(checked) => onToggle(skill.id, checked)}
          aria-label={`Toggle ${skill.name}`}
        />
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => onTest(skill)}
          title="Test skill"
        >
          <Play className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => onEdit(skill)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-error hover:text-error"
          onClick={() => onDelete(skill.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function WritingSkillsPage() {
  const { data: skills = [], isLoading } = useWritingSkillsQuery();
  const createMutation = useCreateWritingSkillMutation();
  const updateMutation = useUpdateWritingSkillMutation();
  const deleteMutation = useDeleteWritingSkillMutation();
  const reorderMutation = useReorderWritingSkillsMutation();
  const runPipelineMutation = useRunSkillsPipelineMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [orderedSkills, setOrderedSkills] = useState<WritingSkill[] | null>(
    null,
  );

  // Test skill state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testSkill, setTestSkill] = useState<WritingSkill | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");

  const displaySkills = orderedSkills ?? skills;
  const isEditing = !!editingId;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (skill: WritingSkill) => {
    setEditingId(skill.id);
    setForm({
      name: skill.name,
      description: skill.description,
      prompt: skill.prompt,
      provider: skill.provider as "claude" | "gpt" | "gemini",
      model: skill.model,
      enabled: skill.enabled,
    });
    setDialogOpen(true);
  };

  const openTest = (skill: WritingSkill) => {
    setTestSkill(skill);
    setTestInput("");
    setTestOutput("");
    setTestDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.prompt.trim()) return;

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: editingId, ...form });
        toast.success("Skill updated");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Skill created");
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
      toast.success("Skill deleted");
      setDeleteId(null);
      setOrderedSkills(null);
    } catch {
      toast.error("Failed to delete skill");
    }
  }, [deleteId, deleteMutation]);

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        await updateMutation.mutateAsync({ id, enabled });
      } catch {
        toast.error("Failed to toggle skill");
      }
    },
    [updateMutation],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const items = [...displaySkills];
      const oldIndex = items.findIndex((s) => s.id === active.id);
      const newIndex = items.findIndex((s) => s.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      setOrderedSkills(reordered);

      const orderMap: Record<string, number> = {};
      reordered.forEach((skill, index) => {
        orderMap[skill.id] = index;
      });

      reorderMutation.mutate(orderMap, {
        onError: () => {
          setOrderedSkills(null);
          toast.error("Failed to reorder skills");
        },
      });
    },
    [displaySkills, reorderMutation],
  );

  const handleTest = async () => {
    if (!testSkill || !testInput.trim()) return;
    try {
      const result = await runPipelineMutation.mutateAsync({
        content: testInput,
        skillIds: [testSkill.id],
      });
      setTestOutput(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Test failed";
      toast.error(message);
    }
  };

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
          { label: "Skills" },
        ]}
        actions={
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={openCreate}
          >
            <Plus className="size-3.5" />
            Add Skill
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!isLoading && displaySkills.length === 0 ? (
          <EmptyState
            icon={Wand2}
            title="No Writing Skills"
            description="Writing skills are AI prompts that process your content. Create one or reload to seed the defaults."
          />
        ) : (
          <div className="max-w-3xl space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displaySkills.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {displaySkills.map((skill) => (
                  <SortableSkillCard
                    key={skill.id}
                    skill={skill}
                    onEdit={openEdit}
                    onDelete={setDeleteId}
                    onToggle={handleToggle}
                    onTest={openTest}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Skill" : "Add Writing Skill"}
            </DialogTitle>
            <DialogDescription>
              Define an AI prompt that processes content in the skills pipeline.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                placeholder="e.g., Tone Adjuster"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-desc">Description</Label>
              <Input
                id="skill-desc"
                placeholder="Brief description of what this skill does"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-prompt">System Prompt</Label>
              <Textarea
                id="skill-prompt"
                placeholder="Instructions for the AI when processing content..."
                value={form.prompt}
                onChange={(e) => updateField("prompt", e.target.value)}
                disabled={isPending}
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="skill-provider">Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(v) =>
                    updateField("provider", v as "claude" | "gpt" | "gemini")
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="skill-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="gpt">GPT</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-model">Model (optional)</Label>
                <Input
                  id="skill-model"
                  placeholder="Default model"
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
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
              <Button
                type="submit"
                disabled={!form.name.trim() || !form.prompt.trim() || isPending}
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

      {/* Test Skill Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test: {testSkill?.name}</DialogTitle>
            <DialogDescription>
              Enter sample text to see how this skill processes content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-input">Input Content</Label>
              <Textarea
                id="test-input"
                placeholder="Paste or type sample content here..."
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                rows={6}
                disabled={runPipelineMutation.isPending}
              />
            </div>
            <Button
              onClick={handleTest}
              disabled={!testInput.trim() || runPipelineMutation.isPending}
              className="gap-1.5"
            >
              <Play className="size-3.5" />
              {runPipelineMutation.isPending ? "Processing..." : "Run Skill"}
            </Button>
            {testOutput && (
              <div className="space-y-2">
                <Label>Output</Label>
                <div className="rounded-lg border bg-muted p-4 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {testOutput}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Writing Skill"
        description="Are you sure you want to delete this writing skill? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
