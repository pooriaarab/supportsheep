"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { queryKeys } from "@/lib/query-keys";
import {
  DEFAULT_PERMALINK_SETTINGS,
  buildArticlePaths,
  type SupportedPermalinkPattern,
} from "@/lib/permalinks";
import { toast } from "sonner";
import type { BlogConfig } from "@repo/types";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { Label } from "@repo/ui/primitives/label";
import { Switch } from "@repo/ui/primitives/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";

const EXAMPLE_ARTICLE = {
  slug: "ideas-for-personal-websites",
  category: "guides",
};

async function fetchBlogConfig(): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config");
  if (!res.ok) throw new Error("Failed to fetch blog config");
  const json = await res.json();
  return json.data;
}

async function updateBlogConfig(data: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/v1/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error("Failed to update permalink settings");
  }
}

export default function PermalinkSettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: fetchBlogConfig,
  });

  const permalinkSettings =
    config?.permalinks ?? DEFAULT_PERMALINK_SETTINGS;

  const [selectedPattern, setSelectedPattern] =
    useState<SupportedPermalinkPattern | null>(null);
  const [redirectLegacy, setRedirectLegacy] = useState<boolean | null>(null);

  const currentPattern =
    selectedPattern ?? permalinkSettings.canonicalPattern;
  const currentRedirectLegacy =
    redirectLegacy ?? permalinkSettings.redirectOldPatterns;

  const preview = useMemo(
    () =>
      buildArticlePaths(EXAMPLE_ARTICLE, {
        ...permalinkSettings,
        canonicalPattern: currentPattern,
        redirectOldPatterns: currentRedirectLegacy,
      }),
    [currentPattern, currentRedirectLegacy, permalinkSettings],
  );

  const mutation = useMutation({
    mutationFn: updateBlogConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.blogConfig.all,
      });
      toast.success("Permalink settings updated");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update permalink settings",
      );
    },
  });

  const handleSave = () => {
    mutation.mutate({
      permalinks: {
        canonicalPattern: currentPattern,
        redirectOldPatterns: currentRedirectLegacy,
        allowedPatterns: permalinkSettings.allowedPatterns,
      },
    });
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Permalinks" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="p-6 space-y-6">
            <div className="pb-4 border-b border-border">
              <h3 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                Permalink Settings
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Choose the canonical article URL format and preserve legacy
                paths with redirects during migration.
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="canonicalPattern">
                    Canonical article format
                  </Label>
                  <Select
                    value={currentPattern}
                    onValueChange={(value) =>
                      setSelectedPattern(value as SupportedPermalinkPattern)
                    }
                  >
                    <SelectTrigger id="canonicalPattern" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/<slug>/">/{EXAMPLE_ARTICLE.slug}/</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Root-level article URLs are the only supported canonical
                    format in this release. Other WordPress-style patterns stay
                    in the config model for future expansion, but they are not
                    editable here yet.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="redirectLegacy">
                      Redirect legacy article URLs
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Keep old permalink shapes working with redirects to the
                      canonical path.
                    </p>
                  </div>
                  <Switch
                    id="redirectLegacy"
                    checked={currentRedirectLegacy}
                    onCheckedChange={setRedirectLegacy}
                  />
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Preview</p>
                  <p className="text-sm text-muted-foreground">
                    Canonical: <span className="font-mono">{preview.canonicalPath}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Redirects:
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {preview.legacyPaths.map((path) => (
                      <li key={path} className="font-mono">
                        {path}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-sm text-warning-foreground">
                  Changing the canonical format updates article metadata,
                  sitemap URLs, feed links, and redirect targets.
                </div>

                <div className="flex justify-end pt-2">
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
                    Save Changes
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
