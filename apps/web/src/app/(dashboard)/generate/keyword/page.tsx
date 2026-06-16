"use client";

import { useState, useRef, useCallback } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Switch } from "@repo/ui/primitives/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/primitives/dialog";
import {
  Sparkles,
  FileText,
  List,
  BookOpen,
  Scale,
  Star,
  BookMarked,
  BookA,
  Target,
  Loader2,
  Check,
  Circle,
} from "lucide-react";
import { POST_TYPES, type PostType } from "@repo/types";
import { useContextTagsQuery } from "@/app/(dashboard)/writing/context-tags/hooks/use-context-tags-query";
import { toast } from "sonner";

/* ---------- Generation steps ---------- */

const GENERATION_STEPS = [
  { key: "research", label: "Researching topic…", durationMs: 3000 },
  { key: "title", label: "Generating title…", durationMs: 3000 },
  { key: "outline", label: "Creating outline…", durationMs: 4000 },
  { key: "body", label: "Writing content…", durationMs: 5000 },
  { key: "seo", label: "Optimizing for SEO…", durationMs: 3000 },
  { key: "images", label: "Finding images…", durationMs: 3000 },
  { key: "saving", label: "Saving article…", durationMs: 2000 },
] as const;

type StepStatus = "pending" | "active" | "done";

/* ---------- Post type card data ---------- */

const POST_TYPE_INFO: Record<
  PostType,
  { label: string; description: string; icon: typeof FileText }
> = {
  blog_post: {
    label: "Blog Post",
    description: "General SEO article",
    icon: FileText,
  },
  listicle: {
    label: "Listicle",
    description: '"Top N" format',
    icon: List,
  },
  how_to: {
    label: "How-To Guide",
    description: "Step-by-step tutorial",
    icon: BookOpen,
  },
  comparison: {
    label: "Comparison",
    description: "X vs Y analysis",
    icon: Scale,
  },
  product_review: {
    label: "Product Review",
    description: "In-depth review",
    icon: Star,
  },
  pillar_page: {
    label: "Pillar Page",
    description: "Comprehensive guide",
    icon: BookMarked,
  },
  glossary: {
    label: "Glossary",
    description: "Term definition",
    icon: BookA,
  },
  landing_page: {
    label: "Landing Page",
    description: "Conversion-focused",
    icon: Target,
  },
};

export default function KeywordGeneratePage() {
  const { push } = useRouter();
  const { data: contextTags = [] } = useContextTagsQuery();

  const [keyword, setKeyword] = useState("");
  const [postType, setPostType] = useState<PostType>("blog_post");
  const [contextTagId, setContextTagId] = useState("");
  const [provider, setProvider] = useState<"claude" | "gpt" | "gemini">(
    "claude",
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Progress dialog state
  const [showProgress, setShowProgress] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() =>
    GENERATION_STEPS.map(() => "pending"),
  );
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const startStepProgression = useCallback(() => {
    const statuses: StepStatus[] = GENERATION_STEPS.map(() => "pending");
    statuses[0] = "active";
    setStepStatuses([...statuses]);
    setShowProgress(true);

    let elapsed = 0;
    for (let i = 0; i < GENERATION_STEPS.length; i++) {
      const step = GENERATION_STEPS[i];
      elapsed += step.durationMs;

      const stepIndex = i;
      const timer = setTimeout(() => {
        setStepStatuses((prev) => {
          const next = [...prev];
          next[stepIndex] = "done";
          if (
            stepIndex + 1 < next.length &&
            next[stepIndex + 1] === "pending"
          ) {
            next[stepIndex + 1] = "active";
          }
          return next;
        });
      }, elapsed);
      timersRef.current.push(timer);
    }
  }, []);

  const completeAllSteps = useCallback(() => {
    clearTimers();
    setStepStatuses(GENERATION_STEPS.map(() => "done"));
  }, [clearTimers]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || generating) return;

    setGenerating(true);
    startStepProgression();

    try {
      const res = await fetch("/api/v1/generate/keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          postType,
          contextTagId: contextTagId || undefined,
          provider,
          scheduledAt:
            scheduleEnabled && scheduledAt
              ? new Date(scheduledAt).toISOString()
              : undefined,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error || "Generation failed");
      }

      const data = (await res.json()) as {
        slug: string;
        title: string;
        redirectUrl: string;
      };

      // Jump to completion
      completeAllSteps();

      // Brief pause to show all-done state before navigating
      await new Promise((resolve) => setTimeout(resolve, 800));
      setShowProgress(false);
      toast.success(`Generated: ${data.title}`);
      push(data.redirectUrl);
    } catch (error: unknown) {
      clearTimers();
      setShowProgress(false);
      const message =
        error instanceof Error ? error.message : "Generation failed";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Generate", href: "/generate/keyword" },
          { label: "Keyword to Post" },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Keyword */}
            <div className="space-y-2">
              <Label htmlFor="keyword" className="text-sm font-medium">
                Keyword
              </Label>
              <Input
                id="keyword"
                placeholder="e.g., best project management tools for startups"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                disabled={generating}
              />
            </div>

            {/* Post Type Grid */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Post Type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {POST_TYPES.map((type) => {
                  const info = POST_TYPE_INFO[type];
                  const Icon = info.icon;
                  const isSelected = postType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPostType(type)}
                      disabled={generating}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="text-xs font-medium">{info.label}</span>
                      <span className="text-[10px] leading-tight opacity-70">
                        {info.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Context Tag */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Context Tag (optional)
              </Label>
              <Select
                value={contextTagId}
                onValueChange={setContextTagId}
                disabled={generating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select brand voice…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contextTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) =>
                  setProvider(v as "claude" | "gpt" | "gemini")
                }
                disabled={generating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                  <SelectItem value="gpt">GPT-4o (OpenAI)</SelectItem>
                  <SelectItem value="gemini">Gemini (Google)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Toggle */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                  disabled={generating}
                />
                <Label className="text-sm">Schedule for later</Label>
              </div>
              {scheduleEnabled && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  disabled={generating}
                />
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!keyword.trim() || generating}
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate Article
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Generation Progress Dialog */}
      <Dialog open={showProgress} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Generating Article
            </DialogTitle>
            <DialogDescription>
              Creating your article for &ldquo;{keyword}&rdquo;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {GENERATION_STEPS.map((step, i) => {
              const status = stepStatuses[i];
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 text-sm transition-opacity ${
                    status === "pending" ? "opacity-40" : "opacity-100"
                  }`}
                >
                  {status === "done" ? (
                    <Check className="size-4 shrink-0 text-success" />
                  ) : status === "active" ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={
                      status === "active"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {status === "done"
                      ? step.label.replace("…", "")
                      : step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
