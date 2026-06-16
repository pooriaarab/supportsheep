"use client";

/**
 * Settings Tab -- right sidebar tab for editing article metadata.
 *
 * Contains: slug, post type, category, tags, featured image, OG image.
 * Title is edited inline in the editor area (editor-layout.tsx).
 * SEO-specific fields (metaTitle, metaDescription, keywords) are in the SEO tab.
 */

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
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
import { Badge } from "@repo/ui/primitives/badge";
import { POST_TYPES } from "@repo/types";
import type { PostType } from "@repo/types";
import { X, Upload, Trash2, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { GenerateImageDialog } from "./generate-image-dialog";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useUsersQuery } from "@/hooks/use-users-query";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ArticleMetadata } from "@/components/posts/editor/metadata-panel";

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

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/* -------------------------------------------------------------------------- */
/* Word Counter                                                                */
/* -------------------------------------------------------------------------- */

function WordCounter({
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
      {current} / {min}-{max} words
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
/* Image Picker                                                                */
/* -------------------------------------------------------------------------- */

function ImagePicker({
  value,
  onChange,
  onAltChange,
  label,
  id,
  slug,
}: {
  value: string;
  onChange: (url: string) => void;
  onAltChange?: (alt: string) => void;
  label: string;
  id: string;
  slug?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingClickRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const purpose: "featured-image" | "inline" =
    label === "Featured Image" ? "featured-image" : "inline";

  const handleSparklesClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pendingClickRef.current !== null) {
        clearTimeout(pendingClickRef.current);
        pendingClickRef.current = null;
        void (async () => {
          try {
            const res = await fetch("/api/v1/generate/image", {
              method: "Article",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ purpose, slug }),
            });
            if (!res.ok) throw new Error("Generation failed");
            const data = (await res.json()) as { url: string; alt: string };
            onChange(data.url);
            onAltChange?.(data.alt);
            toast.success("Image generated");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Generation failed");
          }
        })();
      } else {
        pendingClickRef.current = setTimeout(() => {
          pendingClickRef.current = null;
          setDialogOpen(true);
        }, 350);
      }
    },
    [purpose, slug, onChange, onAltChange],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/v1/media", {
          method: "Article",
          body: formData,
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(err.error || "Upload failed");
        }
        const data = (await res.json()) as { url: string };
        onChange(data.url);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to upload image";
        toast.error(message);
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleUpload],
  );

  if (value) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="rounded-md border border-border overflow-hidden">
          <div
            className="relative h-32"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <Image
              src={value}
              alt={label}
              fill
              sizes="320px"
              unoptimized
              className="w-full h-32 object-cover bg-muted"
            />
            {slug && hovered && (
              <button
                type="button"
                aria-label="Generate with AI"
                onClick={handleSparklesClick}
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-foreground/60 text-background hover:bg-foreground/80 transition-colors"
              >
                <Sparkles className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 p-1.5 bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] flex-1 gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Upload className="size-3" />
              )}
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive"
              onClick={() => onChange("")}
            >
              <Trash2 className="size-3" />
              Remove
            </Button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {slug && (
          <GenerateImageDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            slug={slug}
            purpose={purpose}
            onComplete={({ url, alt }) => {
              onChange(url);
              onAltChange?.(alt);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {urlInput ? (
        <div className="space-y-1.5">
          <Input
            id={id}
            placeholder="Paste image URL..."
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) onChange(val);
                setUrlInput(false);
              }
              if (e.key === "Escape") setUrlInput(false);
            }}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val) onChange(val);
              setUrlInput(false);
            }}
          />
          <p className="text-[10px] text-muted-foreground">
            Press Enter to confirm or Escape to cancel
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 flex flex-col items-center gap-2">
          <ImageIcon className="size-6 text-muted-foreground/50" />
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Upload className="size-3" />
              )}
              Upload
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => setUrlInput(true)}
            >
              Paste URL
            </Button>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
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
/* Author Field                                                                */
/* -------------------------------------------------------------------------- */

const AUTHOR_NONE_VALUE = "__none__";

function AuthorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (author: string) => void;
}) {
  const { data: users = [], isLoading } = useUsersQuery();
  const { user: currentUser } = useAuth();

  // Build author options from users list
  const authorOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    for (const u of users) {
      const name = u.name?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        options.push({ value: name, label: name });
      }
    }

    // If the current value is not in the list (e.g. manually entered before),
    // include it so the Select shows it correctly
    if (value && !seen.has(value)) {
      options.push({ value, label: value });
    }

    return options;
  }, [users, value]);

  // Default to current user's display name if author is empty. Uses an
  // effect-event so the effect only fires when loading completes — we don't
  // re-fire when the user later clears the value or when onChange identity
  // changes.
  const applyDefaultAuthor = useEffectEvent(() => {
    if (!value && currentUser?.displayName && !isLoading) {
      onChange(currentUser.displayName);
    }
  });
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!isLoading) applyDefaultAuthor();
  }, [isLoading]);

  // Fall back to a text input if no users are loaded and not loading
  if (!isLoading && authorOptions.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="settings-author-input" className="text-xs font-medium">
          Author
        </Label>
        <Input
          id="settings-author-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Author name"
          className="h-8 text-xs"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Author</Label>
      <Select
        value={value || AUTHOR_NONE_VALUE}
        onValueChange={(v) => onChange(v === AUTHOR_NONE_VALUE ? "" : v)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select author" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTHOR_NONE_VALUE}>None</SelectItem>
          {authorOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

interface SettingsTabProps {
  metadata: ArticleMetadata;
  onChange: (updates: Partial<ArticleMetadata>) => void;
}

export function SettingsTab({ metadata, onChange }: SettingsTabProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const [autoSlug, setAutoSlug] = useState(true);

  // Auto-generate slug from title when autoSlug is on. The slug lives on the
  // parent (metadata), so we cannot regenerate it as pure derived state —
  // propagating to the parent must happen in an event-like callback. We use
  // useEffectEvent to avoid re-subscribing when the latest slug/onChange
  // identity changes; the effect only re-runs on a real title change.
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
    <div className="space-y-5 p-4 overflow-y-auto">
      {/* Slug */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="settings-slug-input" className="text-xs font-medium">
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
          id="settings-slug-input"
          value={metadata.slug}
          onChange={handleSlugChange}
          placeholder="article-slug"
          className="h-8 text-xs font-mono"
        />
      </div>

      {/* Summary (TL;DR) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="settings-summary-input" className="text-xs font-medium">
            Summary (TL;DR)
          </Label>
          <WordCounter
            current={countWords(metadata.summary)}
            min={40}
            max={80}
          />
        </div>
        <Textarea
          id="settings-summary-input"
          value={metadata.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          placeholder="40-80 word direct answer to the article's question — shown above the hero and read by voice assistants."
          className="text-xs min-h-[80px] resize-none"
          rows={4}
        />
      </div>

      {/* Author */}
      <AuthorField
        value={metadata.author}
        onChange={(author) => onChange({ author })}
      />

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
      <ImagePicker
        value={metadata.featuredImage}
        onChange={(url) =>
          onChange(url ? { featuredImage: url } : { featuredImage: "", featuredImageAlt: "" })
        }
        onAltChange={(alt) => onChange({ featuredImageAlt: alt })}
        label="Featured Image"
        id="settings-featured-image"
        slug={metadata.slug || undefined}
      />

      {/* Featured Image Alt Text */}
      <div className="space-y-1.5">
        <Label
          htmlFor="settings-featured-image-alt"
          className="text-xs font-medium"
        >
          Featured Image Alt Text
        </Label>
        <Input
          id="settings-featured-image-alt"
          value={metadata.featuredImageAlt}
          onChange={(e) => onChange({ featuredImageAlt: e.target.value })}
          placeholder="Describe the image for accessibility"
          className="h-8 text-xs"
          disabled={!metadata.featuredImage}
        />
        <p className="text-[10px] text-muted-foreground">
          Improves accessibility and SEO. Falls back to the article title when
          empty.
        </p>
      </div>

      {/* OG Image */}
      <ImagePicker
        value={metadata.ogImage}
        onChange={(url) => onChange({ ogImage: url })}
        label="OG Image"
        id="settings-og-image"
        slug={metadata.slug || undefined}
      />
    </div>
  );
}
