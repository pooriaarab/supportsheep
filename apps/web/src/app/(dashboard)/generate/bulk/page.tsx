"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Button } from "@repo/ui/primitives/button";
import { Label } from "@repo/ui/primitives/label";
import { Textarea } from "@repo/ui/primitives/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Badge } from "@repo/ui/primitives/badge";
import { Blocks, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { POST_TYPES, type PostType } from "@repo/types";
import { useContextTagsQuery } from "@/app/(dashboard)/writing/context-tags/hooks/use-context-tags-query";
import { toast } from "sonner";

interface BulkResultItem {
  keyword: string;
  status: "success" | "failed";
  slug?: string;
  title?: string;
  error?: string;
}

export default function BulkGeneratePage() {
  const { data: contextTags = [] } = useContextTagsQuery();

  const [keywordsText, setKeywordsText] = useState("");
  const [postType, setPostType] = useState<PostType>("blog_post");
  const [contextTagId, setContextTagId] = useState("");
  const [provider, setProvider] = useState<"claude" | "gpt" | "gemini">(
    "claude",
  );
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<BulkResultItem[] | null>(null);

  const keywords = keywordsText
    .split("\n")
    .map((k) => k.trim())
    .filter(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (keywords.length === 0 || generating) return;

    setGenerating(true);
    setResults(null);

    try {
      const res = await fetch("/api/v1/generate/bulk", {
        method: "Article",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: keywords.map((kw) => ({
            keyword: kw,
            postType,
            contextTagId: contextTagId || undefined,
          })),
          provider,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error || "Bulk generation failed");
      }

      const data = (await res.json()) as {
        results: BulkResultItem[];
        summary: { total: number; success: number; failed: number };
      };
      setResults(data.results);
      toast.success(
        `Generated ${data.summary.success}/${data.summary.total} articles`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Bulk generation failed";
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
          { label: "Bulk Generate" },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="keywords" className="text-sm font-medium">
                Keywords (one per line)
              </Label>
              <Textarea
                id="keywords"
                placeholder={`best project management tools\nhow to write a business plan\ntop CRM software for small business`}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                disabled={generating}
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                {keywords.length} keyword{keywords.length !== 1 ? "s" : ""}{" "}
                detected (max 50)
              </p>
            </div>

            {/* Post Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Post Type (applied to all)
              </Label>
              <Select
                value={postType}
                onValueChange={(v) => setPostType(v as PostType)}
                disabled={generating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POST_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {/* Submit */}
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={keywords.length === 0 || generating}
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating {keywords.length} articles…
                </>
              ) : (
                <>
                  <Blocks className="size-4" />
                  Generate {keywords.length} Article
                  {keywords.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </form>

          {/* Results */}
          {results && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Results</h3>
              {results.map((item) => (
                <div
                  key={
                    item.slug ??
                    `${item.keyword}-${item.status}-${item.title ?? item.error ?? ""}`
                  }
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  {item.status === "success" ? (
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-error shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.title || item.keyword}
                    </p>
                    {item.status === "failed" && item.error && (
                      <p className="text-xs text-error mt-0.5">{item.error}</p>
                    )}
                  </div>
                  <Badge
                    variant={
                      item.status === "success" ? "default" : "destructive"
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
