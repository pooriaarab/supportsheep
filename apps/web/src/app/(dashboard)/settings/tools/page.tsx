"use client";

import type { FreeTool, FreeToolCategory } from "@repo/types";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@repo/ui/primitives/badge";
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
import { Textarea } from "@repo/ui/primitives/textarea";
import { ExternalLink, Loader2, Save, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/layout/page-header";
import { queryKeys } from "@/lib/query-keys";

type ToolProvider = FreeTool["ai"]["provider"];

const CATEGORY_LABELS: Record<FreeToolCategory, string> = {
  seo: "SEO",
  writing: "Writing",
  social: "Social",
  schema: "Schema",
  utility: "Utility",
  business: "Business",
  aeo_geo: "AEO/GEO",
};

const PROVIDERS: Array<{ value: ToolProvider; label: string }> = [
  { value: "claude", label: "Claude" },
  { value: "gpt", label: "GPT" },
  { value: "gemini", label: "Gemini" },
];

async function fetchFreeTools(): Promise<FreeTool[]> {
  const response = await fetch("/api/v1/free-tools");
  if (!response.ok) {
    throw new Error("Failed to fetch free tools");
  }
  const json = await response.json();
  return json.data ?? [];
}

async function seedFreeTools(): Promise<{ created: number; skipped: number }> {
  const response = await fetch("/api/v1/free-tools/seed", {
    method: "Article",
  });
  if (!response.ok) {
    throw new Error("Failed to seed free tools");
  }
  const json = await response.json();
  return json.data;
}

async function updateFreeTool(tool: FreeTool): Promise<FreeTool> {
  const response = await fetch(`/api/v1/free-tools/${tool.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enabled: tool.enabled,
      slug: tool.slug,
      title: tool.title,
      metaTitle: tool.metaTitle,
      metaDescription: tool.metaDescription,
      intro: tool.intro,
      seo: {
        ...tool.seo,
        canonicalPath: `/tools/${tool.slug}`,
      },
      callout: tool.callout,
      ai: tool.ai,
    }),
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error || "Failed to update free tool");
  }
  const json = await response.json();
  return json.data;
}

function normalizeDraft(tool: FreeTool): FreeTool {
  return {
    ...tool,
    seo: {
      ...tool.seo,
      canonicalPath: `/tools/${tool.slug}`,
    },
  };
}

export default function FreeToolsSettingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FreeToolCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, FreeTool>>({});

  const { data: tools = [], isLoading } = useQuery({
    queryKey: queryKeys.freeTools.list(),
    queryFn: fetchFreeTools,
  });

  const activeSelectedId = selectedId ?? tools[0]?.id ?? null;
  const selectedTool = useMemo(
    () =>
      tools.find((tool) => tool.id === activeSelectedId) ?? tools[0] ?? null,
    [activeSelectedId, tools],
  );
  const draft = selectedTool
    ? (drafts[selectedTool.id] ?? normalizeDraft(selectedTool))
    : null;

  const seedMutation = useMutation({
    mutationFn: seedFreeTools,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.freeTools.all });
      toast.success(
        `Seeded ${result.created} tools. ${result.skipped} existing tools skipped.`,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Seed failed");
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateFreeTool,
    onSuccess: (tool) => {
      queryClient.setQueryData<FreeTool[]>(
        queryKeys.freeTools.list(),
        (existing = []) =>
          existing.map((item) => (item.id === tool.id ? tool : item)),
      );
      setDrafts((current) => ({
        ...current,
        [tool.id]: normalizeDraft(tool),
      }));
      toast.success("Tool saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Save failed");
    },
  });

  const filteredTools = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesCategory =
        category === "all" || getCategory(tool) === category;
      const matchesSearch =
        !needle ||
        tool.title.toLowerCase().includes(needle) ||
        tool.slug.toLowerCase().includes(needle) ||
        tool.metaDescription.toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [category, search, tools]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          tools.flatMap((tool) => {
            const category = getCategory(tool);
            return category ? [category] : [];
          }),
        ),
      ).sort() as FreeToolCategory[],
    [tools],
  );

  const saveDraft = () => {
    if (!draft) {
      return;
    }
    updateMutation.mutate(normalizeDraft(draft));
  };

  const patchDraft = <Key extends keyof FreeTool>(
    key: Key,
    value: FreeTool[Key],
  ) => {
    if (!draft) {
      return;
    }
    replaceDraft({ ...draft, [key]: value });
  };

  const replaceDraft = (tool: FreeTool) => {
    setDrafts((current) => ({
      ...current,
      [tool.id]: normalizeDraft(tool),
    }));
  };

  const setEnabled = (tool: FreeTool, enabled: boolean) => {
    updateMutation.mutate(normalizeDraft({ ...tool, enabled }));
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Tools" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-fluid-2xl font-semibold tracking-tight">
                Free Tools
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Manage the public SEO tool catalog, basic page copy, callouts,
                and phase-one AI limits.
              </p>
            </div>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="w-fit gap-2"
            >
              {seedMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Seed tools
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="gap-4 rounded-lg p-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    aria-label="Search tools"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tools"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as FreeToolCategory | "all")
                  }
                >
                  <SelectTrigger aria-label="Tool category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CATEGORY_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-[calc(100vh-330px)] space-y-2 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTools.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No tools match this search.
                  </p>
                ) : (
                  filteredTools.map((tool) => (
                    <div
                      key={tool.id}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        tool.id === activeSelectedId
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(tool.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-medium">
                            {tool.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            /tools/{tool.slug}
                          </p>
                        </button>
                        <Switch
                          aria-label={`Enable ${tool.title}`}
                          checked={tool.enabled}
                          disabled={updateMutation.isPending}
                          onCheckedChange={(checked) =>
                            setEnabled(tool, checked)
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="rounded-lg p-4 sm:p-6">
              {!draft ? (
                <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
                  Seed tools to begin editing the catalog.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-semibold tracking-tight">
                          {draft.title}
                        </h2>
                        <Badge variant={draft.enabled ? "default" : "outline"}>
                          {draft.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Template: {draft.templateId}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/tools/${draft.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gap-1.5"
                        >
                          <ExternalLink className="size-3.5" />
                          Preview
                        </a>
                      </Button>
                      <Button
                        onClick={saveDraft}
                        disabled={updateMutation.isPending}
                        size="sm"
                        className="gap-1.5"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>

                  <section className="grid gap-4 md:grid-cols-2">
                    <Field label="Title" htmlFor="tool-title">
                      <Input
                        id="tool-title"
                        value={draft.title}
                        onChange={(event) =>
                          patchDraft("title", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Slug" htmlFor="tool-slug">
                      <Input
                        id="tool-slug"
                        value={draft.slug}
                        onChange={(event) =>
                          patchDraft("slug", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Meta title" htmlFor="tool-meta-title">
                      <Input
                        id="tool-meta-title"
                        value={draft.metaTitle}
                        onChange={(event) =>
                          patchDraft("metaTitle", event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Meta description"
                      htmlFor="tool-meta-description"
                    >
                      <Textarea
                        id="tool-meta-description"
                        value={draft.metaDescription}
                        onChange={(event) =>
                          patchDraft("metaDescription", event.target.value)
                        }
                        className="min-h-24"
                      />
                    </Field>
                    <Field label="Intro" htmlFor="tool-intro">
                      <Textarea
                        id="tool-intro"
                        value={draft.intro}
                        onChange={(event) =>
                          patchDraft("intro", event.target.value)
                        }
                        className="min-h-32"
                      />
                    </Field>
                    <div className="space-y-4 rounded-md border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label htmlFor="tool-enabled">Enabled</Label>
                          <p className="text-xs text-muted-foreground">
                            Enabled tools can resolve on public URLs.
                          </p>
                        </div>
                        <Switch
                          id="tool-enabled"
                          checked={draft.enabled}
                          onCheckedChange={(checked) =>
                            patchDraft("enabled", checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label htmlFor="tool-indexable">Indexable</Label>
                          <p className="text-xs text-muted-foreground">
                            Controls public index visibility.
                          </p>
                        </div>
                        <Switch
                          id="tool-indexable"
                          checked={draft.seo.indexable}
                          onCheckedChange={(checked) =>
                            replaceDraft({
                              ...draft,
                              seo: { ...draft.seo, indexable: checked },
                            })
                          }
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-md border border-border p-4">
                    <h3 className="text-sm font-semibold">Bottom callout</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Heading" htmlFor="callout-heading">
                        <Input
                          id="callout-heading"
                          value={draft.callout.heading}
                          onChange={(event) =>
                            replaceDraft({
                              ...draft,
                              callout: {
                                ...draft.callout,
                                heading: event.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="Primary label" htmlFor="callout-label">
                        <Input
                          id="callout-label"
                          value={draft.callout.primaryLabel}
                          onChange={(event) =>
                            replaceDraft({
                              ...draft,
                              callout: {
                                ...draft.callout,
                                primaryLabel: event.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="Primary URL" htmlFor="callout-url">
                        <Input
                          id="callout-url"
                          value={draft.callout.primaryUrl}
                          onChange={(event) =>
                            replaceDraft({
                              ...draft,
                              callout: {
                                ...draft.callout,
                                primaryUrl: event.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="UTM campaign" htmlFor="callout-campaign">
                        <Input
                          id="callout-campaign"
                          value={draft.callout.utm.campaign}
                          onChange={(event) =>
                            replaceDraft({
                              ...draft,
                              callout: {
                                ...draft.callout,
                                utm: {
                                  ...draft.callout.utm,
                                  campaign: event.target.value,
                                },
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="Body" htmlFor="callout-body">
                        <Textarea
                          id="callout-body"
                          value={draft.callout.body}
                          onChange={(event) =>
                            replaceDraft({
                              ...draft,
                              callout: {
                                ...draft.callout,
                                body: event.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-md border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">AI execution</h3>
                        <p className="text-xs text-muted-foreground">
                          Applies to AI-capable predefined templates.
                        </p>
                      </div>
                      <Switch
                        aria-label="Enable AI for tool"
                        checked={draft.ai.enabled}
                        onCheckedChange={(checked) =>
                          replaceDraft({
                            ...draft,
                            ai: { ...draft.ai, enabled: checked },
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Provider" htmlFor="tool-ai-provider">
                        <Select
                          value={draft.ai.provider}
                          onValueChange={(value) =>
                            replaceDraft({
                              ...draft,
                              ai: {
                                ...draft.ai,
                                provider: value as ToolProvider,
                              },
                            })
                          }
                        >
                          <SelectTrigger id="tool-ai-provider">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROVIDERS.map((provider) => (
                              <SelectItem
                                key={provider.value}
                                value={provider.value}
                              >
                                {provider.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Model" htmlFor="tool-ai-model">
                        <Input
                          id="tool-ai-model"
                          value={draft.ai.model}
                          onChange={(event) =>
                            replaceDraft({
                              ...draft,
                              ai: {
                                ...draft.ai,
                                model: event.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <Field label="Daily limit" htmlFor="tool-ai-limit">
                        <Input
                          id="tool-ai-limit"
                          type="number"
                          min={1}
                          value={draft.ai.dailyLimit}
                          onChange={(event) =>
                            replaceDraft({
                              ...draft,
                              ai: {
                                ...draft.ai,
                                dailyLimit:
                                  Number.parseInt(event.target.value, 10) || 1,
                              },
                            })
                          }
                        />
                      </Field>
                    </div>
                  </section>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  children,
  label,
  htmlFor,
}: {
  children: ReactNode;
  label: string;
  htmlFor: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function getCategory(tool: FreeTool): FreeToolCategory {
  const prefix = tool.templateId.split("-")[0];
  if (tool.templateId.includes("schema")) {
    return "schema";
  }
  if (
    tool.templateId.includes("linkedin") ||
    tool.templateId.includes("caption")
  ) {
    return "social";
  }
  if (
    ["word", "slug", "utm", "case", "password", "timestamp"].includes(prefix)
  ) {
    return "utility";
  }
  if (
    tool.templateId.includes("keyword") ||
    tool.templateId.includes("meta") ||
    tool.templateId.includes("seo")
  ) {
    return "seo";
  }
  if (
    tool.templateId.includes("business") ||
    tool.templateId.includes("product") ||
    tool.templateId.includes("service") ||
    tool.templateId.includes("ad")
  ) {
    return "business";
  }
  if (
    tool.templateId.includes("answer") ||
    tool.templateId.includes("entity")
  ) {
    return "aeo_geo";
  }
  return "writing";
}
