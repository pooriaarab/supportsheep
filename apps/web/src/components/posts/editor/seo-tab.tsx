"use client";

/**
 * SEO Tab -- right sidebar tab combining SEO field editing with score display.
 *
 * Contains: metaTitle, metaDescription, keywords fields (moved from metadata panel)
 * and the existing SEO score breakdown below.
 */

import { useCallback } from "react";
import { Input } from "@repo/ui/primitives/input";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Label } from "@repo/ui/primitives/label";
import { Badge } from "@repo/ui/primitives/badge";
import { Separator } from "@repo/ui/primitives/separator";
import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SeoSidebar } from "@/components/posts/editor/seo-sidebar";
import type { ArticleMetadata } from "@/components/posts/editor/metadata-panel";
import type { PostType } from "@repo/types";

/* -------------------------------------------------------------------------- */
/* Character Counter                                                           */
/* -------------------------------------------------------------------------- */

function CharCounter({
  current,
  min,
  max,
}: {
  current: number;
  min: number;
  max: number;
}) {
  const status =
    current >= min && current <= max
      ? "text-success"
      : current > 0
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <span className={cn("text-[10px]", status)}>
      {current}/{min}-{max}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tag Input                                                                   */
/* -------------------------------------------------------------------------- */

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const trimmed = input.trim();
        if (trimmed && !values.includes(trimmed)) {
          onChange([...values, trimmed]);
        }
        setInput("");
      } else if (e.key === "Backspace" && !input && values.length > 0) {
        onChange(values.slice(0, -1));
      }
    },
    [input, values, onChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(values.filter((v) => v !== tag));
    },
    [values, onChange],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {values.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-sm hover:bg-muted"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

interface SeoTabProps {
  body: string;
  metadata: ArticleMetadata;
  onChange: (updates: Partial<ArticleMetadata>) => void;
}

export function SeoTab({ body, metadata, onChange }: SeoTabProps) {
  return (
    <div className="space-y-4 p-4 overflow-y-auto">
      {/* SEO Fields */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          SEO Fields
        </h3>
      </div>

      {/* Meta Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-tab-meta-title" className="text-xs font-medium">
            Meta Title
          </Label>
          <CharCounter current={metadata.metaTitle.length} min={50} max={60} />
        </div>
        <Input
          id="seo-tab-meta-title"
          value={metadata.metaTitle}
          onChange={(e) => onChange({ metaTitle: e.target.value })}
          placeholder="SEO title"
          className="h-8 text-xs"
        />
      </div>

      {/* Meta Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-tab-meta-desc" className="text-xs font-medium">
            Meta Description
          </Label>
          <CharCounter
            current={metadata.metaDescription.length}
            min={150}
            max={160}
          />
        </div>
        <Textarea
          id="seo-tab-meta-desc"
          value={metadata.metaDescription}
          onChange={(e) => onChange({ metaDescription: e.target.value })}
          placeholder="SEO description"
          className="text-xs min-h-[60px] resize-none"
          rows={3}
        />
      </div>

      {/* Keywords */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Keywords</Label>
        <TagInput
          values={metadata.keywords}
          onChange={(keywords) => onChange({ keywords })}
          placeholder="Add keyword"
        />
      </div>

      <Separator />

      {/* SEO Score */}
      <SeoSidebar
        body={body}
        metaTitle={metadata.metaTitle}
        metaDescription={metadata.metaDescription}
        keywords={metadata.keywords}
        postType={metadata.postType as PostType}
      />
    </div>
  );
}
