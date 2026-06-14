"use client";

/**
 * Metadata Panel -- left sidebar for editing article metadata and SEO fields.
 *
 * Fields: title, slug, category, tags, featured image, post type,
 * meta title, meta description, keywords, OG image.
 */

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { Input } from "@repo/ui/primitives/input";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Label } from "@repo/ui/primitives/label";
import { Button } from "@repo/ui/primitives/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Separator } from "@repo/ui/primitives/separator";
import { Badge } from "@repo/ui/primitives/badge";
import { POST_TYPES } from "@repo/types";
import type { PostType } from "@repo/types";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface ArticleMetadata {
  title: string;
  slug: string;
  category: string;
  tags: string[];
  featuredImage: string;
  featuredImageAlt: string;
  postType: PostType;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogImage: string;
  excerpt: string;
  /**
   * Optional 40-80 word direct answer rendered as a TL;DR callout above the
   * featured image on the public article page and exposed to voice assistants
   * via the Speakable schema.
   */
  summary: string;
  author: string;
}

interface MetadataPanelProps {
  metadata: ArticleMetadata;
  onChange: (updates: Partial<ArticleMetadata>) => void;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const CATEGORY_NONE_VALUE = "__none__";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function formatPostType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/* Tag Input (inline)                                                          */
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
/* Categories Hook                                                             */
/* -------------------------------------------------------------------------- */

interface CategoryItem {
  slug: string;
  displayName: string;
}

function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: async () => {
      const res = await fetch("/api/v1/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const json = (await res.json()) as { data: CategoryItem[] };
      return json.data;
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function MetadataPanel({
  metadata,
  onChange,
  className,
}: MetadataPanelProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const [autoSlug, setAutoSlug] = useState(true);

  // Auto-generate slug from title when autoSlug is on. The slug lives on the
  // parent (metadata), so we cannot regenerate it as pure derived state from
  // this component — propagating to the parent must happen in an event-like
  // callback. We achieve that with an effect-event: fire when title changes,
  // but never re-subscribe based on the latest `metadata.slug` / `onChange`.
  const syncSlugFromTitle = useEffectEvent((title: string) => {
    if (!autoSlug || !title) return;
    const generated = slugify(title);
    if (generated !== metadata.slug) {
      onChange({ slug: generated });
    }
  });
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    syncSlugFromTitle(metadata.title);
  }, [metadata.title]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ title: e.target.value });
    },
    [onChange],
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAutoSlug(false);
      onChange({ slug: slugify(e.target.value) });
    },
    [onChange],
  );

  const categoryOptions = useMemo(
    () => categories.filter((cat) => cat.slug && cat.slug.trim() !== ""),
    [categories],
  );

  return (
    <div
      className={cn(
        "w-72 border-r border-border bg-background overflow-y-auto p-4 space-y-5",
        className,
      )}
    >
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="meta-title-input" className="text-xs font-medium">
          Title
        </Label>
        <Input
          id="meta-title-input"
          value={metadata.title}
          onChange={handleTitleChange}
          placeholder="Article title"
          className="h-8 text-sm"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="meta-slug-input" className="text-xs font-medium">
            Slug
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-1.5"
            onClick={() => {
              setAutoSlug(true);
              onChange({ slug: slugify(metadata.title) });
            }}
          >
            Auto
          </Button>
        </div>
        <Input
          id="meta-slug-input"
          value={metadata.slug}
          onChange={handleSlugChange}
          placeholder="article-slug"
          className="h-8 text-xs font-mono"
        />
      </div>

      {/* Post Type */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Post Type</Label>
        <Select
          value={metadata.postType}
          onValueChange={(v) => onChange({ postType: v as PostType })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POST_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {formatPostType(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Category</Label>
        <Select
          value={metadata.category || CATEGORY_NONE_VALUE}
          onValueChange={(v) =>
            onChange({ category: v === CATEGORY_NONE_VALUE ? "" : v })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATEGORY_NONE_VALUE}>None</SelectItem>
            {categoryOptions.map((cat) => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {cat.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Tags</Label>
        <TagInput
          values={metadata.tags}
          onChange={(tags) => onChange({ tags })}
          placeholder="Type and press Enter"
        />
      </div>

      {/* Featured Image */}
      <div className="space-y-1.5">
        <Label htmlFor="meta-featured-image" className="text-xs font-medium">
          Featured Image
        </Label>
        <Input
          id="meta-featured-image"
          value={metadata.featuredImage}
          onChange={(e) => onChange({ featuredImage: e.target.value })}
          placeholder="Image URL"
          className="h-8 text-xs"
        />
        <Input
          id="meta-featured-image-alt"
          value={metadata.featuredImageAlt}
          onChange={(e) => onChange({ featuredImageAlt: e.target.value })}
          placeholder="Alt text (for screen readers and SEO)"
          className="h-8 text-xs"
          disabled={!metadata.featuredImage}
        />
      </div>

      <Separator />

      {/* SEO Section */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          SEO
        </h3>
      </div>

      {/* Meta Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-meta-title" className="text-xs font-medium">
            Meta Title
          </Label>
          <CharCounter current={metadata.metaTitle.length} min={50} max={60} />
        </div>
        <Input
          id="seo-meta-title"
          value={metadata.metaTitle}
          onChange={(e) => onChange({ metaTitle: e.target.value })}
          placeholder="SEO title"
          className="h-8 text-xs"
        />
      </div>

      {/* Meta Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-meta-desc" className="text-xs font-medium">
            Meta Description
          </Label>
          <CharCounter
            current={metadata.metaDescription.length}
            min={150}
            max={160}
          />
        </div>
        <Textarea
          id="seo-meta-desc"
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

      {/* OG Image */}
      <div className="space-y-1.5">
        <Label htmlFor="seo-og-image" className="text-xs font-medium">
          OG Image
        </Label>
        <Input
          id="seo-og-image"
          value={metadata.ogImage}
          onChange={(e) => onChange({ ogImage: e.target.value })}
          placeholder="OG image URL"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}
