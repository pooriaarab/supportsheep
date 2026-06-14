"use client";

/**
 * Editor Layout -- full-page article editor orchestrator.
 *
 * Structure:
 *   Header: back button, title, save status, preview toggle, publish dropdown, right panel toggle
 *   Center: TipTap rich text editor (full width) or preview mode
 *   Right sidebar (tabs): Settings | SEO | Versions | AI
 *
 * Split into EditorLayout (data fetcher) and EditorInner (renders when data is ready)
 * to avoid calling setState in an effect for initialization.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEditor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";
import { getEditorExtensions, type SlashCommandState } from "@/lib/tiptap";
import { RichTextEditorShell } from "@/components/shared/rich-text-editor-shell";
import { type ArticleMetadata } from "@/components/posts/editor/metadata-panel";
import { SettingsTab } from "@/components/posts/editor/settings-tab";
import { SeoTab } from "@/components/posts/editor/seo-tab";
import { InternalLinksTab } from "@/components/posts/editor/internal-links-tab";
import { VersionHistory } from "@/components/posts/editor/version-history";
import { AiChatTab } from "@/components/posts/editor/ai-chat-tab";
import { useAutosave } from "@/hooks/use-autosave";
import { getArticlePath } from "@/lib/permalinks";
import { queryKeys } from "@/lib/query-keys";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { cn } from "@/lib/utils";
import { getIndexNowStatusLabel } from "@/lib/seo/submission-status";
import { toast } from "sonner";
import { Button } from "@repo/ui/primitives/button";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/primitives/tabs";
import { Skeleton } from "@repo/ui/primitives/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@repo/ui/primitives/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/primitives/dialog";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  ArrowLeft,
  PanelRight,
  Cloud,
  CloudOff,
  Loader2,
  Check,
  BarChart3,
  History,
  Settings,
  Sparkles,
  ChevronDown,
  Globe,
  Calendar,
  EyeOff,
  FileText,
  Eye,
  Pencil,
  Clock,
  Link2,
} from "lucide-react";
import type { Article, BlogConfig, CategoryEntry } from "@repo/types";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface EditorLayoutProps {
  slug: string;
  fromInterview?: string;
}

type RightTab = "settings" | "seo" | "links" | "versions" | "ai";

interface SaveDraftPayload {
  draftBody: string;
  note: string;
}

interface UpdateMetaPayload {
  [key: string]: unknown;
  action: "update-meta";
}

/* -------------------------------------------------------------------------- */
/* API helpers                                                                 */
/* -------------------------------------------------------------------------- */

async function fetchArticle(slug: string): Promise<Article & { id: string }> {
  const res = await fetch(`/api/v1/articles/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Failed to fetch article");
  return (await res.json()) as Article & { id: string };
}

async function patchArticle(
  slug: string,
  body: Record<string, unknown>,
): Promise<Article & { id: string }> {
  const res = await fetch(`/api/v1/articles/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Failed to save");
  }
  return (await res.json()) as Article & { id: string };
}

/* -------------------------------------------------------------------------- */
/* Save Status Indicator                                                       */
/* -------------------------------------------------------------------------- */

function SaveStatusBadge({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  switch (status) {
    case "saving":
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Saving…
        </span>
      );
    case "saved":
      return (
        <span className="flex items-center gap-1 text-[10px] text-success">
          <Check className="size-3" /> Saved
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-[10px] text-destructive">
          <CloudOff className="size-3" /> Save failed
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Cloud className="size-3" />
        </span>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Schedule Dialog                                                             */
/* -------------------------------------------------------------------------- */

function formatSchedulePreview(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function ScheduleDialog({
  open,
  onOpenChange,
  onSchedule,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (at: string) => void;
  loading: boolean;
}) {
  const [scheduledAt, setScheduledAt] = useState("");

  const getMinDatetime = useCallback(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  }, []);

  const handleConfirm = useCallback(() => {
    if (scheduledAt) {
      onSchedule(new Date(scheduledAt).toISOString());
    }
  }, [scheduledAt, onSchedule]);

  const preview = formatSchedulePreview(scheduledAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule Post</DialogTitle>
          <DialogDescription>
            Pick a date and time to publish this post automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="schedule-datetime" className="text-xs font-medium">
              Publish date & time
            </Label>
            <Input
              id="schedule-datetime"
              type="datetime-local"
              value={scheduledAt}
              min={getMinDatetime()}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {preview && (
            <div className="flex items-start gap-2.5 rounded-md bg-muted/50 border border-border px-3 py-2.5">
              <Clock className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Will be published on{" "}
                <span className="font-medium text-foreground">{preview}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!scheduledAt || loading}
            onClick={handleConfirm}
          >
            {loading && <Loader2 className="size-3 animate-spin mr-1.5" />}
            {loading ? "Scheduling…" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Article Preview                                                             */
/* -------------------------------------------------------------------------- */

interface CategoryWithSlug extends CategoryEntry {
  slug: string;
}

function usePreviewData() {
  const configQuery = useQuery({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: async () => {
      const res = await fetch("/api/v1/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      return (await res.json()) as BlogConfig;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: async () => {
      const res = await fetch("/api/v1/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const json = (await res.json()) as { data: CategoryWithSlug[] };
      return json.data;
    },
  });

  return {
    config: configQuery.data,
    categories: categoriesQuery.data ?? [],
  };
}

function ArticlePreview({
  title,
  body,
  category,
  tags,
  author,
  wordCount,
  featuredImage,
  featuredImageAlt,
}: {
  title: string;
  body: string;
  category: string;
  tags: string[];
  author: string;
  wordCount: number;
  featuredImage: string;
  featuredImageAlt: string;
}) {
  const { config } = usePreviewData();
  const readingTime = Math.max(1, Math.ceil(wordCount / 250));
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const defaultConfig: BlogConfig = {
    blogId: "",
    siteName: "Supportsheep",
    siteDescription: "",
    logo: "",
    publicAppearance: { themeMode: "light" },
    homepage: { layout: "grid", postsPerPage: 12, featuredCategory: null },
    seo: {
      defaultMetaTitle: "",
      defaultMetaDescription: "",
      googleAnalyticsId: "",
      clarityId: "",
    },
    ai: {
      defaultProvider: "claude",
      providers: {
        claude: { apiKey: "", model: "" },
        gpt: { apiKey: "", model: "" },
        gemini: { apiKey: "", model: "" },
      },
      defaultContextTagId: "",
      defaultSkillsPipeline: [],
    },
    publishing: { defaultStatus: "draft", autoSchedule: false },
  };

  const resolvedConfig = config ?? defaultConfig;

  return (
    <div className="bg-background min-h-full flex flex-col">
      {/* Actual public header */}
      <PublicHeader config={resolvedConfig} />

      <div className="flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
          <article className="max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <nav className="mb-6 text-sm text-muted-foreground">
              <span className="hover:text-foreground transition-colors cursor-pointer">
                Blog
              </span>
              {category && (
                <>
                  <span className="mx-2">/</span>
                  <span className="hover:text-foreground transition-colors cursor-pointer">
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </span>
                </>
              )}
              <span className="mx-2">/</span>
              <span className="text-foreground">{title || "Untitled"}</span>
            </nav>

            {/* Header */}
            <header className="mb-8">
              {category && (
                <span className="inline-block mb-3 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {category}
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground leading-tight">
                {title || "Untitled"}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {author && <span>{author}</span>}
                {author && <span aria-hidden="true">&middot;</span>}
                <time>{today}</time>
                {readingTime > 0 && (
                  <>
                    <span aria-hidden="true">&middot;</span>
                    <span>{readingTime} min read</span>
                  </>
                )}
              </div>
            </header>

            {/* Featured image */}
            {featuredImage && (
              <div className="mb-8 rounded-lg overflow-hidden">
                <Image
                  src={featuredImage}
                  alt={featuredImageAlt || title}
                  width={1200}
                  height={630}
                  unoptimized
                  className="w-full h-auto"
                />
              </div>
            )}

            {/* Article body */}
            <div
              className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary prose-img:rounded-lg"
              dangerouslySetInnerHTML={{ __html: body }}
            />

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-8 pt-6 border-t border-border">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </div>

      {/* Actual public footer */}
      <PublicFooter config={resolvedConfig} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeleton                                                            */
/* -------------------------------------------------------------------------- */

function EditorSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="h-12 border-b border-border flex items-center gap-3 px-4">
        <Skeleton className="size-6 rounded" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex-1 flex">
        <div className="flex-1 p-8">
          <Skeleton className="h-6 w-3/4 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="w-80 border-l border-border p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Outer component: fetches data, renders inner when ready                     */
/* -------------------------------------------------------------------------- */

export function EditorLayout({ slug, fromInterview }: EditorLayoutProps) {
  const { push } = useRouter();

  const {
    data: article,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.articles.detail(slug),
    queryFn: () => fetchArticle(slug),
  });

  if (isLoading) return <EditorSkeleton />;

  if (error || !article) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">
            {error?.message ?? "Article not found"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => push("/posts")}
          >
            Back to Posts
          </Button>
        </div>
      </div>
    );
  }

  return <EditorInner slug={slug} article={article} fromInterview={fromInterview} />;
}

/* -------------------------------------------------------------------------- */
/* Inner component: all editor logic, initialized from article prop            */
/* -------------------------------------------------------------------------- */

function EditorInner({
  slug,
  article,
  fromInterview,
}: {
  slug: string;
  article: Article & { id: string };
  fromInterview?: string;
}) {
  const { push } = useRouter();
  const queryClient = useQueryClient();

  /* -- State (initialized from article prop, no effect needed) -- */
  const [activeTab, setActiveTab] = useState<RightTab>("settings");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const [draftBody, setDraftBody] = useState(
    () => article.draftBody || article.body || "",
  );

  const [metadata, setMetadata] = useState<ArticleMetadata>(() => ({
    title: article.title ?? "",
    slug: article.slug ?? "",
    category: article.category ?? "",
    tags: article.tags ?? [],
    featuredImage: article.featuredImage?.url ?? "",
    featuredImageAlt: article.featuredImage?.alt ?? "",
    postType: article.postType ?? "blog_post",
    metaTitle: article.metaTitle ?? "",
    metaDescription: article.metaDescription ?? "",
    keywords: article.keywords ?? [],
    ogImage: article.ogImage ?? "",
    excerpt: article.excerpt ?? "",
    summary: article.summary ?? "",
    author: article.author ?? "",
  }));

  /* -- Slash command state -- */
  const [slashState, setSlashState] = useState<SlashCommandState>({
    active: false,
    query: "",
    slashPos: 0,
    coords: null,
  });

  /* -- TipTap Editor --
   *
   * The extensions list is computed once on mount. `setSlashState` is a stable
   * React state setter, so the closure is safe to capture. Re-creating this
   * array on every render would re-instantiate every ProseMirror plugin on
   * every keystroke -- TipTap's `useEditor` does not reset its internal editor
   * across renders, but the dropped extension instances still allocate work.
   */
  const extensions = useMemo(
    () => [
      ...getEditorExtensions({
        placeholder: "Start writing your article…",
        slashCommands: { onStateChange: setSlashState },
      }),
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: false,
      }),
    ],
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: draftBody || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none py-4 min-h-[calc(100vh-220px)]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      setDraftBody(ed.getHTML());
    },
  });

  /* -- Sync external content to editor (for version restore) -- */
  const restoreToEditor = useCallback(
    (body: string) => {
      if (!editor) return;
      setDraftBody(body);
      editor.commands.setContent(body, { emitUpdate: false });
      toast.success("Version restored");
    },
    [editor],
  );

  /* -- Autosave draft body -- */
  const autosaveData = useMemo<SaveDraftPayload>(
    () => ({
      draftBody,
      note: "",
    }),
    [draftBody],
  );

  const { status: saveStatus } = useAutosave({
    data: autosaveData,
    onSave: async (data) => {
      await patchArticle(slug, {
        action: "save-draft",
        ...data,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.articles.detail(slug),
      });
    },
    enabled: true,
    debounceMs: 2000,
  });

  /* -- Update metadata mutation -- */
  const metaMutation = useMutation({
    mutationFn: async (updates: Partial<ArticleMetadata>) => {
      // Combine featuredImage url + alt into the object shape for persistence.
      const { featuredImage, featuredImageAlt, ...rest } = updates;
      const needsFeatured =
        featuredImage !== undefined || featuredImageAlt !== undefined;
      const featuredPayload = needsFeatured
        ? {
            featuredImage: {
              url: featuredImage ?? metadata.featuredImage,
              alt: featuredImageAlt ?? metadata.featuredImageAlt,
            },
          }
        : {};
      const payload: UpdateMetaPayload = {
        action: "update-meta",
        ...rest,
        ...featuredPayload,
      };
      return patchArticle(slug, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.articles.detail(slug),
      });
    },
    onError: () => {
      toast.error("Failed to update metadata");
    },
  });

  /* -- Debounced metadata save -- */
  const metaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMetadataChange = useCallback(
    (updates: Partial<ArticleMetadata>) => {
      setMetadata((prev) => ({ ...prev, ...updates }));

      if (metaTimeoutRef.current) clearTimeout(metaTimeoutRef.current);
      metaTimeoutRef.current = setTimeout(() => {
        metaMutation.mutate(updates);
      }, 1500);
    },
    [metaMutation],
  );

  // Cleanup meta timeout on unmount
  useMountEffect(() => {
    return () => {
      if (metaTimeoutRef.current) clearTimeout(metaTimeoutRef.current);
    };
  });

  /* -- Publish / Schedule / Unpublish / Save as Draft -- */
  const publishMutation = useMutation({
    mutationFn: async () => {
      return patchArticle(slug, { action: "publish" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.articles.detail(slug),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      toast.success("Article published!", {
        action: {
          label: "View article",
          onClick: () => window.open(getArticlePath(article), "_blank"),
        },
      });
    },
    onError: () => {
      toast.error("Failed to publish");
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (scheduledAt: string) => {
      return patchArticle(slug, { action: "schedule", scheduledAt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.articles.detail(slug),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      setScheduleOpen(false);
      toast.success("Article scheduled");
    },
    onError: () => {
      toast.error("Failed to schedule");
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      return patchArticle(slug, { action: "unpublish" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.articles.detail(slug),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      toast.success("Unpublished");
    },
    onError: () => {
      toast.error("Failed to unpublish");
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      return patchArticle(slug, { action: "save-draft", draftBody, note: "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.articles.detail(slug),
      });
      toast.success("Saved as draft");
    },
    onError: () => {
      toast.error("Failed to save draft");
    },
  });

  const isActionPending =
    publishMutation.isPending ||
    scheduleMutation.isPending ||
    unpublishMutation.isPending ||
    saveDraftMutation.isPending;

  const isPublished = article.status === "published";

  /* -- Word count -- */
  const wordCount = useMemo(() => {
    const stripped = draftBody
      .replace(/<[^>]*>/g, "")
      .replace(/[#*_~`>|\-[\]()]/g, " ");
    return stripped.trim().split(/\s+/).filter(Boolean).length;
  }, [draftBody]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {fromInterview && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-xs flex items-center justify-between flex-shrink-0 text-primary">
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles className="size-3.5" />
            <span>Editing an interview-generated draft.</span>
          </div>
          <a
            href={`/interview/sessions/${fromInterview}`}
            className="underline font-semibold hover:text-primary/80 flex items-center gap-0.5"
          >
            View original session &rarr;
          </a>
        </div>
      )}
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-background flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {previewMode ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs shrink-0"
              onClick={() => setPreviewMode(false)}
            >
              <Pencil className="size-3.5" />
              Back to editor
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 shrink-0"
              onClick={() => push("/posts")}
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}

          <h1 className="text-sm font-medium truncate min-w-0">
            {metadata.title || "Untitled"}
          </h1>

          {previewMode ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wider bg-info/15 text-info">
              Preview
            </span>
          ) : (
            <>
              <SaveStatusBadge status={saveStatus} />

              {article.status && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wider",
                    article.status === "published" &&
                      "bg-success/15 text-success",
                    article.status === "draft" &&
                      "bg-muted text-muted-foreground",
                    article.status === "scheduled" &&
                      "bg-warning/15 text-warning",
                    article.status === "archived" &&
                      "bg-muted text-muted-foreground",
                  )}
                >
                  {article.status}
                </span>
              )}

              <span className="text-[10px] text-muted-foreground">
                IndexNow:{" "}
                {getIndexNowStatusLabel(
                  article.submissionStatus?.indexNow?.status,
                )}
                {article.submissionStatus?.indexNow?.lastSubmittedAt
                  ? ` • ${new Date(
                      article.submissionStatus.indexNow.lastSubmittedAt,
                    ).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : ""}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Preview toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "size-7 p-0",
                  previewMode && "bg-muted text-foreground",
                )}
                onClick={() => setPreviewMode((prev) => !prev)}
              >
                {previewMode ? (
                  <Pencil className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {previewMode ? "Edit" : "Preview"}
            </TooltipContent>
          </Tooltip>

          {!previewMode && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                onClick={() => setShowRightPanel((prev) => !prev)}
              >
                <PanelRight className="size-4" />
              </Button>

              {/* Publish split button */}
              <div className="flex items-center">
                <Button
                  size="sm"
                  className="h-7 text-xs rounded-r-none"
                  disabled={isActionPending}
                  onClick={() => publishMutation.mutate()}
                >
                  {isActionPending ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : null}
                  {isPublished ? "Update" : "Publish"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 px-1.5 rounded-l-none border-l border-primary-foreground/20"
                      disabled={isActionPending}
                    >
                      <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => publishMutation.mutate()}
                      className="gap-2 text-xs"
                    >
                      <Globe className="size-3.5" />
                      Publish Now
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setScheduleOpen(true)}
                      className="gap-2 text-xs"
                    >
                      <Calendar className="size-3.5" />
                      Schedule…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isPublished && (
                      <DropdownMenuItem
                        onClick={() => unpublishMutation.mutate()}
                        className="gap-2 text-xs"
                      >
                        <EyeOff className="size-3.5" />
                        Unpublish
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => saveDraftMutation.mutate()}
                      className="gap-2 text-xs"
                    >
                      <FileText className="size-3.5" />
                      Save as Draft
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Main area ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center: Editor or Preview (fixed width, centered) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {previewMode ? (
            /* -- Preview mode -- */
            <div className="flex-1 overflow-y-auto">
              <ArticlePreview
                title={metadata.title}
                body={draftBody}
                category={metadata.category}
                tags={metadata.tags}
                author={metadata.author}
                wordCount={wordCount}
                featuredImage={metadata.featuredImage}
                featuredImageAlt={metadata.featuredImageAlt}
              />
            </div>
          ) : (
            /* -- Edit mode -- */
            <RichTextEditorShell
              editor={editor}
              slashState={slashState}
              articleSlug={slug}
              articleTitle={metadata.title}
              articleExcerpt={metadata.excerpt}
              topSlot={
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) =>
                    handleMetadataChange({ title: e.target.value })
                  }
                  placeholder="Post title…"
                  className="w-full text-3xl md:text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 pt-8 pb-2"
                />
              }
            />
          )}
          {/* Word count footer (hidden in preview mode) */}
          {!previewMode && (
            <div className="flex items-center justify-end px-4 py-1 border-t border-border bg-muted/30">
              <span className="text-[10px] text-muted-foreground">
                {wordCount} words
              </span>
            </div>
          )}
        </div>

        {/* Right: Settings / SEO / Versions / AI sidebar (hidden in preview mode) */}
        {showRightPanel && !previewMode && (
          <div className="w-80 border-l border-border bg-background flex-shrink-0 hidden lg:flex flex-col overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as RightTab)}
            >
              <TabsList className="w-full justify-start rounded-none border-b border-border h-9 bg-transparent px-1">
                <TabsTrigger
                  value="settings"
                  className="h-7 text-xs gap-1 data-[state=active]:bg-muted"
                >
                  <Settings className="size-3" />
                  Settings
                </TabsTrigger>
                <TabsTrigger
                  value="seo"
                  className="h-7 text-xs gap-1 data-[state=active]:bg-muted"
                >
                  <BarChart3 className="size-3" />
                  SEO
                </TabsTrigger>
                <TabsTrigger
                  value="links"
                  className="h-7 text-xs gap-1 data-[state=active]:bg-muted"
                >
                  <Link2 className="size-3" />
                  Links
                </TabsTrigger>
                <TabsTrigger
                  value="versions"
                  className="h-7 text-xs gap-1 data-[state=active]:bg-muted"
                >
                  <History className="size-3" />
                  Versions
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="h-7 text-xs gap-1 data-[state=active]:bg-muted"
                >
                  <Sparkles className="size-3" />
                  AI
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex-1 overflow-y-auto">
              {activeTab === "settings" && (
                <SettingsTab
                  metadata={metadata}
                  onChange={handleMetadataChange}
                />
              )}
              {activeTab === "seo" && (
                <SeoTab
                  body={draftBody}
                  metadata={metadata}
                  onChange={handleMetadataChange}
                />
              )}
              {activeTab === "links" && (
                <InternalLinksTab body={draftBody} editor={editor} />
              )}
              {activeTab === "versions" && (
                <VersionHistory
                  versions={article.versions ?? []}
                  currentBody={draftBody}
                  onRestore={restoreToEditor}
                />
              )}
              {activeTab === "ai" && <AiChatTab />}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSchedule={(at) => scheduleMutation.mutateAsync(at)}
        loading={scheduleMutation.isPending}
      />
    </div>
  );
}
