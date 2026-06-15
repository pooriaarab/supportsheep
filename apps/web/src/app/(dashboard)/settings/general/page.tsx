"use client";

/**
 * Settings > General (Blog)
 *
 * Site name, description, logo URL, default publishing status.
 */

import { useState, useCallback } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Button } from "@repo/ui/primitives/button";
import { Switch } from "@repo/ui/primitives/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Skeleton } from "@repo/ui/primitives/skeleton";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { BlogConfig } from "@repo/types";

async function fetchBlogConfig(): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config");
  if (!res.ok) throw new Error("Failed to fetch blog config");
  const json = await res.json();
  return json.data;
}

async function updateBlogConfig(
  data: Record<string, unknown>,
): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update blog config");
  const json = await res.json();
  return json.data;
}

export default function BlogGeneralSettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: fetchBlogConfig,
  });

  const [siteName, setSiteName] = useState<string | null>(null);
  const [siteDescription, setSiteDescription] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<string | null>(null);
  const [indexNowEnabled, setIndexNowEnabled] = useState<boolean | null>(null);
  const [indexNowApiKey, setIndexNowApiKey] = useState<string | null>(null);
  const [gaMeasurementId, setGaMeasurementId] = useState<string | null>(null);

  const currentSiteName = siteName ?? config?.siteName ?? "";
  const currentDescription = siteDescription ?? config?.siteDescription ?? "";
  const currentLogo = logo ?? config?.logo ?? "";
  const currentDefaultStatus =
    defaultStatus ?? config?.publishing?.defaultStatus ?? "draft";
  const currentIndexNowEnabled =
    indexNowEnabled ??
    config?.seo?.submissionProtocols?.indexNow?.enabled ??
    false;
  const currentIndexNowApiKey =
    indexNowApiKey ?? config?.seo?.submissionProtocols?.indexNow?.apiKey ?? "";
  const currentGaMeasurementId =
    gaMeasurementId ?? config?.analytics?.gaMeasurementId ?? "";

  const mutation = useMutation({
    mutationFn: updateBlogConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.blogConfig.all,
      });
      toast.success("Settings updated");
    },
    onError: () => {
      toast.error("Failed to update settings");
    },
  });

  const handleSave = useCallback(() => {
    mutation.mutate({
      siteName: currentSiteName,
      siteDescription: currentDescription,
      logo: currentLogo,
      publishing: { defaultStatus: currentDefaultStatus },
      seo: {
        submissionProtocols: {
          indexNow: {
            enabled: currentIndexNowEnabled,
            apiKey: currentIndexNowApiKey,
          },
        },
      },
      analytics: {
        gaMeasurementId: currentGaMeasurementId.trim().toUpperCase(),
      },
    });
  }, [
    mutation,
    currentSiteName,
    currentDescription,
    currentLogo,
    currentDefaultStatus,
    currentIndexNowEnabled,
    currentIndexNowApiKey,
    currentGaMeasurementId,
  ]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Blog General" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="p-6">
            <div className="pb-4 border-b border-border mb-6">
              <h2 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                Support Portal Settings
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Configure your public blog name, description, and publishing
                defaults.
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-6" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    value={currentSiteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="My Support Hub"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteDescription">Description</Label>
                  <Textarea
                    id="siteDescription"
                    value={currentDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    placeholder="A short description of your knowledge base"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input
                    id="logo"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={currentLogo}
                    onChange={(e) => setLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  {currentLogo && (
                    <div className="mt-2">
                      <Image
                        src={currentLogo}
                        alt="Current logo preview"
                        width={40}
                        height={40}
                        unoptimized
                        className="size-10 rounded border border-border object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Default Publishing Status</Label>
                  <p className="text-xs text-muted-foreground">
                    Status applied to newly created articles
                  </p>
                  <Select
                    value={currentDefaultStatus}
                    onValueChange={(v) => setDefaultStatus(v)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      Search Submission
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure blog-wide submission protocols for published
                      articles.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="indexNowEnabled">Enable IndexNow</Label>
                      <p className="text-xs text-muted-foreground">
                        Every publish action submits the article URL when this
                        is enabled.
                      </p>
                    </div>
                    <Switch
                      id="indexNowEnabled"
                      checked={currentIndexNowEnabled}
                      onCheckedChange={setIndexNowEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="indexNowApiKey">IndexNow API Key</Label>
                    <Input
                      id="indexNowApiKey"
                      autoComplete="off"
                      spellCheck={false}
                      value={currentIndexNowApiKey}
                      onChange={(e) => setIndexNowApiKey(e.target.value)}
                      placeholder="058b276c7c7a45da9ed0633b18decd92"
                    />
                    <p className="text-xs text-muted-foreground">
                      Supportsheep automatically serves{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                        /{currentIndexNowApiKey || "<key>"}.txt
                      </code>{" "}
                      when this key is configured.
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      Analytics
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Track your public blog&apos;s pageviews in your own Google
                      Analytics account.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gaMeasurementId">
                      Google Analytics Measurement ID
                    </Label>
                    <Input
                      id="gaMeasurementId"
                      autoComplete="off"
                      spellCheck={false}
                      value={currentGaMeasurementId}
                      onChange={(e) => setGaMeasurementId(e.target.value)}
                      placeholder="G-XXXXXXXXXX"
                      maxLength={50}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your GA4 Measurement ID (looks like{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                        G-XXXXXXXXXX
                      </code>
                      ). When set, the standard gtag.js
                      tag is added to your public blog pages. Leave empty to
                      disable.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={handleSave}
                    disabled={mutation.isPending}
                    className="gap-1.5"
                  >
                    {mutation.isPending ? (
                      <Loader2
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="size-3.5" aria-hidden="true" />
                    )}
                    {mutation.isPending ? "Saving…" : "Save Changes"}
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
