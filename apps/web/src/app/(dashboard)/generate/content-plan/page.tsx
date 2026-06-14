"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Badge } from "@repo/ui/primitives/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Calendar, Loader2, Sparkles } from "lucide-react";
import { EmptyState } from "@repo/ui/composites/empty-state";
import type { ContentPlanPost } from "@repo/types";
import { useContextTagsQuery } from "@/app/(dashboard)/writing/context-tags/hooks/use-context-tags-query";
import { toast } from "sonner";

export default function ContentPlanPage() {
  const { data: contextTags = [] } = useContextTagsQuery();

  const [niche, setNiche] = useState("");
  const [duration, setDuration] = useState<"7" | "14" | "30">("30");
  const [contextTagId, setContextTagId] = useState("");
  const [provider, setProvider] = useState<"claude" | "gpt" | "gemini">(
    "claude",
  );
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<{
    id: string;
    name: string;
    posts: ContentPlanPost[];
  } | null>(null);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || generating) return;

    setGenerating(true);
    setPlan(null);

    try {
      const res = await fetch("/api/v1/generate/content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          duration,
          contextTagId: contextTagId || undefined,
          provider,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error || "Plan generation failed");
      }

      const data = (await res.json()) as {
        id: string;
        name: string;
        postCount: number;
      };

      // Fetch the full plan to display
      const planRes = await fetch(
        `/api/v1/generate/content-plan?id=${data.id}`,
      );
      if (planRes.ok) {
        const planData = (await planRes.json()) as {
          data: { id: string; name: string; posts: ContentPlanPost[] };
        };
        setPlan(planData.data);
      } else {
        // Fall back to showing just the summary
        setPlan({
          id: data.id,
          name: data.name,
          posts: [],
        });
      }

      toast.success(`Content plan created with ${data.postCount} posts`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Plan generation failed";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleGeneratePost = async (post: ContentPlanPost, index: number) => {
    if (!plan) return;

    try {
      const res = await fetch("/api/v1/generate/keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: post.keyword,
          postType: post.postType,
          contextTagId: post.contextTagId || undefined,
          provider,
          scheduledAt: new Date(post.scheduledDate).toISOString(),
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error || "Generation failed");
      }

      const data = (await res.json()) as { slug: string; title: string };
      toast.success(`Generated: ${data.title}`);

      // Update the local plan state
      setPlan((prev) => {
        if (!prev) return prev;
        const updated = [...prev.posts];
        updated[index] = {
          ...updated[index],
          status: "generated",
          articleSlug: data.slug,
        };
        return { ...prev, posts: updated };
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Generation failed";
      toast.error(message);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Generate", href: "/generate/keyword" },
          { label: "Content Plans" },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Form */}
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="niche" className="text-sm font-medium">
                Niche / Topic Area
              </Label>
              <Input
                id="niche"
                placeholder="e.g., B2B SaaS marketing"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                disabled={generating}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Duration</Label>
                <Select
                  value={duration}
                  onValueChange={(v) => setDuration(v as "7" | "14" | "30")}
                  disabled={generating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Context Tag</Label>
                <Select
                  value={contextTagId}
                  onValueChange={setContextTagId}
                  disabled={generating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
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

              <div className="space-y-2">
                <Label className="text-sm font-medium">Provider</Label>
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
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="gpt">GPT-4o</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!niche.trim() || generating}
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating plan…
                </>
              ) : (
                <>
                  <Calendar className="size-4" />
                  Generate {duration}-Day Plan
                </>
              )}
            </Button>
          </form>

          {/* Plan Display */}
          {plan && plan.posts.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  {plan.name}
                </h3>
                <Badge variant="secondary">{plan.posts.length} posts</Badge>
              </div>

              <div className="space-y-2">
                {plan.posts.map((post, i) => (
                  <div
                    key={`${post.scheduledDate}-${post.keyword}-${post.postType}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3"
                  >
                    <div className="text-xs text-muted-foreground w-20 shrink-0">
                      {post.scheduledDate}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {post.keyword}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {post.postType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        post.status === "generated"
                          ? "default"
                          : post.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {post.status}
                    </Badge>
                    {post.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleGeneratePost(post, i)}
                      >
                        <Sparkles className="size-3" />
                        Generate
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !generating &&
            !plan && (
              <EmptyState
                icon={Calendar}
                title="No Content Plan"
                description="Enter a niche and generate an AI-powered content calendar."
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
