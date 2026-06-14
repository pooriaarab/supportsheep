"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/layout/page-header";
import { DEFAULT_PUBLIC_ARTICLE_APPEARANCE } from "@/lib/public-article-appearance";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { Button } from "@repo/ui/primitives/button";
import { Card } from "@repo/ui/primitives/card";
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
import type { BlogConfig, PublicArticleAppearanceConfig } from "@repo/types";

async function fetchBlogConfig(): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config");
  if (!res.ok) throw new Error("Failed to fetch config");
  return (await res.json()).data;
}

async function updateBlogConfig(
  data: Record<string, unknown>,
): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update config");
  return (await res.json()).data;
}

function ArticleCardPreview({
  label,
  titleClassName,
  articleTheme,
}: {
  label: string;
  titleClassName: string;
  articleTheme: ReturnType<typeof resolvePublicArticleTheme>;
}) {
  return (
    <div
      className={cn(
        "border border-border bg-card p-5",
        articleTheme.cards.containerClassName,
        articleTheme.cards.hoverClassName,
      )}
      style={articleTheme.cards.containerStyle}
    >
      <div
        className={cn(
          "mb-4 aspect-[16/10] border border-border bg-muted",
          articleTheme.cards.mediaClassName,
        )}
        style={articleTheme.cards.mediaStyle}
      />
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {label}
      </p>
      <h4
        className={cn(
          "font-semibold text-foreground",
          articleTheme.typography.headingFontClassName,
          titleClassName,
        )}
      >
        Supportsheep vs 10Web
      </h4>
      <p
        className={cn(
          "mt-3 text-sm text-muted-foreground",
          articleTheme.typography.bodyFontClassName,
        )}
        style={articleTheme.readingLayout.bodyTextStyle}
      >
        A shorter card preview to show radius, hover, and shadow changes.
      </p>
    </div>
  );
}

function ReadingPreview({
  articleTheme,
}: {
  articleTheme: ReturnType<typeof resolvePublicArticleTheme>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div
        className={cn(
          "min-w-0",
          articleTheme.typography.bodyFontClassName,
        )}
        style={articleTheme.readingLayout.contentContainerStyle}
      >
        <h4
          className={cn(
            "font-semibold text-foreground",
            articleTheme.typography.headingFontClassName,
            articleTheme.typography.pageTitleClassName,
          )}
        >
          Supportsheep article preview
        </h4>
        <div
          className={cn(
            "mt-4",
            articleTheme.readingLayout.summaryClassName,
          )}
          style={articleTheme.readingLayout.summaryStyle}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            TL;DR
          </p>
          <p
            className={cn(
              "mt-2 text-base text-foreground",
              articleTheme.typography.bodyFontClassName,
            )}
            style={articleTheme.readingLayout.bodyTextStyle}
          >
            The article preview reflects reading width, line height, and surface treatment.
          </p>
        </div>
        <div
          className={cn(
            "mt-4 aspect-[16/9] border border-border bg-muted",
            articleTheme.readingLayout.heroClassName,
          )}
          style={articleTheme.readingLayout.heroStyle}
        />
        <div
          className={cn(
            "mt-4",
            articleTheme.typography.proseClassName,
          )}
          style={articleTheme.readingLayout.bodyTextStyle}
        >
          <p>
            Practical guides for small business sites look better when cards, article
            surfaces, and reading rhythm all share the same visual logic.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {articleTheme.tableOfContents.enabled ? (
          <div
            className={articleTheme.tableOfContents.containerClassName}
            style={articleTheme.tableOfContents.containerStyle}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              On this page
            </p>
            <p className="text-sm text-muted-foreground">Introduction</p>
            <p className="mt-2 text-sm text-foreground">How this style reads</p>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Table of contents hidden
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArticleThemeSettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PublicArticleAppearanceConfig | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: fetchBlogConfig,
  });

  const currentArticle =
    draft ?? config?.publicAppearance?.article ?? DEFAULT_PUBLIC_ARTICLE_APPEARANCE;
  const previewTheme = resolvePublicArticleTheme(currentArticle);

  const mutation = useMutation({
    mutationFn: updateBlogConfig,
    onSuccess: (updatedConfig) => {
      setDraft(
        updatedConfig.publicAppearance?.article ?? DEFAULT_PUBLIC_ARTICLE_APPEARANCE,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.blogConfig.all,
      });
      toast.success("Article style settings updated");
    },
    onError: () => {
      toast.error("Failed to update article style settings");
    },
  });

  const updateArticle = useCallback(
    (
      updater: (
        current: PublicArticleAppearanceConfig,
      ) => PublicArticleAppearanceConfig,
    ) => {
      setDraft((current) => updater(current ?? currentArticle));
    },
    [currentArticle],
  );

  const handleSave = useCallback(() => {
    mutation.mutate({
      publicAppearance: {
        article: currentArticle,
      },
    });
  }, [currentArticle, mutation]);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_PUBLIC_ARTICLE_APPEARANCE);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Theme", href: "/settings/theme" },
          { label: "Article Styles" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6">
            <div className="pb-4 border-b border-border mb-6">
              <h3 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                Article Styles
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Control article cards, reading layout, TOC presentation, and typography.
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-8">
                <div className="border-b border-border pb-8 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Cards</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Adjust radius, elevation, and hover behavior for article cards.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cardBorderRadius">Card border radius</Label>
                      <Select
                        value={currentArticle.cards.borderRadiusPreset}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            cards: {
                              ...current.cards,
                              borderRadiusPreset:
                                value as PublicArticleAppearanceConfig["cards"]["borderRadiusPreset"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="cardBorderRadius" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sharp">Sharp</SelectItem>
                          <SelectItem value="soft">Soft</SelectItem>
                          <SelectItem value="round">Round</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cardShadow">Card shadow</Label>
                      <Select
                        value={currentArticle.cards.shadowPreset}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            cards: {
                              ...current.cards,
                              shadowPreset:
                                value as PublicArticleAppearanceConfig["cards"]["shadowPreset"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="cardShadow" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="subtle">Subtle</SelectItem>
                          <SelectItem value="elevated">Elevated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cardHoverStyle">Card hover style</Label>
                      <Select
                        value={currentArticle.cards.hoverStyle}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            cards: {
                              ...current.cards,
                              hoverStyle:
                                value as PublicArticleAppearanceConfig["cards"]["hoverStyle"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="cardHoverStyle" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="border">Border</SelectItem>
                          <SelectItem value="lift">Lift</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cardBorderRadiusOverride">
                        Border radius override
                      </Label>
                      <Input
                        id="cardBorderRadiusOverride"
                        value={currentArticle.cards.borderRadius}
                        onChange={(event) =>
                          updateArticle((current) => ({
                            ...current,
                            cards: {
                              ...current.cards,
                              borderRadius: event.target.value,
                            },
                          }))
                        }
                        placeholder="12px or 0.75rem"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <ArticleCardPreview
                      label="Featured"
                      titleClassName={previewTheme.typography.featuredCardTitleClassName}
                      articleTheme={previewTheme}
                    />
                    <ArticleCardPreview
                      label="List"
                      titleClassName={previewTheme.typography.listCardTitleClassName}
                      articleTheme={previewTheme}
                    />
                    <ArticleCardPreview
                      label="Grid"
                      titleClassName={previewTheme.typography.gridCardTitleClassName}
                      articleTheme={previewTheme}
                    />
                  </div>
                </div>

                <div className="border-b border-border pb-8 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Reading Layout</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Control content width, line spacing, and summary surface treatment.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contentWidth">Content width</Label>
                      <Select
                        value={currentArticle.readingLayout.contentWidthPreset}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            readingLayout: {
                              ...current.readingLayout,
                              contentWidthPreset:
                                value as PublicArticleAppearanceConfig["readingLayout"]["contentWidthPreset"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="contentWidth" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="narrow">Narrow</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="wide">Wide</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customContentWidth">Width override</Label>
                      <Input
                        id="customContentWidth"
                        value={currentArticle.readingLayout.contentWidth}
                        onChange={(event) =>
                          updateArticle((current) => ({
                            ...current,
                            readingLayout: {
                              ...current.readingLayout,
                              contentWidth: event.target.value,
                            },
                          }))
                        }
                        placeholder="72ch or 56rem"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bodyLineHeight">Body line height</Label>
                      <Select
                        value={currentArticle.readingLayout.bodyLineHeightPreset}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            readingLayout: {
                              ...current.readingLayout,
                              bodyLineHeightPreset:
                                value as PublicArticleAppearanceConfig["readingLayout"]["bodyLineHeightPreset"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="bodyLineHeight" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Compact</SelectItem>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="airy">Airy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customBodyLineHeight">Line-height override</Label>
                      <Input
                        id="customBodyLineHeight"
                        value={currentArticle.readingLayout.bodyLineHeight}
                        onChange={(event) =>
                          updateArticle((current) => ({
                            ...current,
                            readingLayout: {
                              ...current.readingLayout,
                              bodyLineHeight: event.target.value,
                            },
                          }))
                        }
                        placeholder="1.8 or 1.9rem"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="summaryBoxStyle">Summary box style</Label>
                      <Select
                        value={currentArticle.readingLayout.summaryBoxStyle}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            readingLayout: {
                              ...current.readingLayout,
                              summaryBoxStyle:
                                value as PublicArticleAppearanceConfig["readingLayout"]["summaryBoxStyle"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="summaryBoxStyle" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="outlined">Outlined</SelectItem>
                          <SelectItem value="filled">Filled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ReadingPreview articleTheme={previewTheme} />
                </div>

                <div className="border-b border-border pb-8 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Table of Contents</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Show, hide, or restyle the sticky navigation on article pages.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="space-y-1">
                        <Label htmlFor="showTableOfContents">Show table of contents</Label>
                        <p className="text-xs text-muted-foreground">
                          Hide the sticky TOC while keeping article content intact.
                        </p>
                      </div>
                      <Switch
                        id="showTableOfContents"
                        checked={currentArticle.tableOfContents.enabled}
                        onCheckedChange={(checked) =>
                          updateArticle((current) => ({
                            ...current,
                            tableOfContents: {
                              ...current.tableOfContents,
                              enabled: checked,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tocStyle">TOC style</Label>
                      <Select
                        value={currentArticle.tableOfContents.stylePreset}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            tableOfContents: {
                              ...current.tableOfContents,
                              stylePreset:
                                value as PublicArticleAppearanceConfig["tableOfContents"]["stylePreset"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="tocStyle" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bordered">Bordered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Typography</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tune headline personality and reading hierarchy without writing CSS.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fontPreset">Font preset</Label>
                      <Select
                        value={currentArticle.typography.fontPreset}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            typography: {
                              ...current.typography,
                              fontPreset:
                                value as PublicArticleAppearanceConfig["typography"]["fontPreset"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="fontPreset" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="editorial">Editorial</SelectItem>
                          <SelectItem value="modern">Modern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="headingScale">Heading scale</Label>
                      <Select
                        value={currentArticle.typography.headingScalePreset}
                        onValueChange={(value) =>
                          updateArticle((current) => ({
                            ...current,
                            typography: {
                              ...current.typography,
                              headingScalePreset:
                                value as PublicArticleAppearanceConfig["typography"]["headingScalePreset"],
                            },
                          }))
                        }
                      >
                        <SelectTrigger id="headingScale" className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Compact</SelectItem>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="display">Display</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={mutation.isPending}
                    className="gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset Article Defaults
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={mutation.isPending}
                    className="gap-1.5"
                  >
                    {mutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
