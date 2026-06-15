"use client";

import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/layout/page-header";
import { queryKeys } from "@/lib/query-keys";
import { Card } from "@repo/ui/primitives/card";
import { Label } from "@repo/ui/primitives/label";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Switch } from "@repo/ui/primitives/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { cn } from "@repo/ui/utils";
import type {
  BlogConfig,
  PublicShellSectionConfig,
  PublicTopBannerConfig,
} from "@repo/types";
import { normalizeTopBannerHex } from "@/lib/top-banner-color";

interface CategoryItem {
  slug: string;
  displayName: string;
  postCount: number;
}

interface UploadResponse {
  url: string;
}

async function fetchBlogConfig(): Promise<BlogConfig> {
  const res = await fetch("/api/v1/config");
  if (!res.ok) throw new Error("Failed to fetch config");
  return (await res.json()).data;
}

async function fetchCategories(): Promise<CategoryItem[]> {
  const res = await fetch("/api/v1/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
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

async function uploadThemeLogo(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("alt", "");

  const res = await fetch("/api/v1/media", {
    method: "Article",
    body: formData,
  });
  if (!res.ok) {
    throw new Error("Failed to upload logo");
  }

  return await res.json();
}

const LAYOUT_OPTIONS = [
  {
    value: "grid" as const,
    label: "Grid",
    description: "Featured hero + card grid",
  },
  {
    value: "sidebar" as const,
    label: "Sidebar",
    description: "Category sidebar + post list",
  },
  {
    value: "hybrid" as const,
    label: "Hybrid",
    description: "Grid homepage, sidebar on articles",
  },
];

const DEFAULT_TOP_BANNER: PublicTopBannerConfig = {
  enabled: false,
  message: "This content is AI-assisted and reviewed by humans where applicable",
  scope: "homepage",
  backgroundColor: "#FFF4D6",
  textColor: "#5F370E",
};

const DEFAULT_HEADER: PublicShellSectionConfig = {
  logoUrl: null,
  text: "",
  backgroundColor: "#1d1133",
  textColor: "#FFFFFF",
};

const DEFAULT_FOOTER: PublicShellSectionConfig = {
  logoUrl: null,
  text: "",
  backgroundColor: "#171325",
  textColor: "#FFFFFF",
};

function resolveTopBannerColor(value: string, fallback: string): string {
  return normalizeTopBannerHex(value) ?? fallback;
}

function ShellPreview({
  title,
  appearance,
}: {
  title: string;
  appearance: PublicShellSectionConfig;
}) {
  return (
    <div className="space-y-2">
      <Label>{title} Preview</Label>
      <div
        className="rounded-md border border-border/60 p-4"
        style={{
          backgroundColor: appearance.backgroundColor,
          color: appearance.textColor,
        }}
      >
        {appearance.logoUrl ? (
          <Image
            src={appearance.logoUrl}
            alt={appearance.text || `${title} logo`}
            width={220}
            height={40}
            unoptimized
            className="h-10 w-auto max-w-[220px] object-contain"
          />
        ) : appearance.text ? (
          <span className="text-lg font-semibold tracking-tight">
            {appearance.text}
          </span>
        ) : (
          <span className="text-sm opacity-70">No logo or text configured</span>
        )}
      </div>
    </div>
  );
}

export default function PublicShellThemeSettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: queryKeys.blogConfig.settings(),
    queryFn: fetchBlogConfig,
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.lists(),
    queryFn: fetchCategories,
  });

  const [layout, setLayout] = useState<string | null>(null);
  const [publicThemeMode, setPublicThemeMode] = useState<string | null>(null);
  const [postsPerPage, setPostsPerPage] = useState<number | null>(null);
  const [featuredCategory, setFeaturedCategory] = useState<
    string | null | undefined
  >(undefined);
  const [topBannerEnabled, setTopBannerEnabled] = useState<boolean | null>(null);
  const [topBannerMessage, setTopBannerMessage] = useState<string | null>(null);
  const [topBannerScope, setTopBannerScope] = useState<
    PublicTopBannerConfig["scope"] | null
  >(null);
  const [topBannerBackgroundColor, setTopBannerBackgroundColor] = useState<
    string | null
  >(null);
  const [topBannerTextColor, setTopBannerTextColor] = useState<string | null>(
    null,
  );
  const [topBannerBackgroundHexInput, setTopBannerBackgroundHexInput] =
    useState<string | null>(null);
  const [topBannerTextHexInput, setTopBannerTextHexInput] = useState<
    string | null
  >(null);
  const [topBannerBackgroundColorError, setTopBannerBackgroundColorError] =
    useState<string | null>(null);
  const [topBannerTextColorError, setTopBannerTextColorError] = useState<
    string | null
  >(null);
  const [headerLogoUrl, setHeaderLogoUrl] = useState<
    string | null | undefined
  >(undefined);
  const [headerText, setHeaderText] = useState<string | null>(null);
  const [headerBackgroundColor, setHeaderBackgroundColor] = useState<
    string | null
  >(null);
  const [headerTextColor, setHeaderTextColor] = useState<string | null>(null);
  const [footerLogoUrl, setFooterLogoUrl] = useState<
    string | null | undefined
  >(undefined);
  const [footerText, setFooterText] = useState<string | null>(null);
  const [footerBackgroundColor, setFooterBackgroundColor] = useState<
    string | null
  >(null);
  const [footerTextColor, setFooterTextColor] = useState<string | null>(null);
  const [uploadingSection, setUploadingSection] = useState<
    "header" | "footer" | null
  >(null);

  const currentLayout = layout ?? config?.homepage?.layout ?? "grid";
  const currentPublicThemeMode =
    publicThemeMode ?? config?.publicAppearance?.themeMode ?? "light";
  const currentPostsPerPage =
    postsPerPage ?? config?.homepage?.postsPerPage ?? 12;
  const currentFeaturedCategory =
    featuredCategory === undefined
      ? (config?.homepage?.featuredCategory ?? "")
      : (featuredCategory ?? "");

  const currentTopBanner = config?.publicAppearance?.topBanner ?? DEFAULT_TOP_BANNER;
  const persistedTopBannerBackgroundColor = resolveTopBannerColor(
    currentTopBanner.backgroundColor,
    DEFAULT_TOP_BANNER.backgroundColor,
  );
  const persistedTopBannerTextColor = resolveTopBannerColor(
    currentTopBanner.textColor,
    DEFAULT_TOP_BANNER.textColor,
  );
  const currentTopBannerEnabled =
    topBannerEnabled ?? currentTopBanner.enabled;
  const currentTopBannerMessage =
    topBannerMessage ?? currentTopBanner.message;
  const currentTopBannerScope = topBannerScope ?? currentTopBanner.scope;
  const currentTopBannerBackgroundColor =
    topBannerBackgroundColor ?? persistedTopBannerBackgroundColor;
  const currentTopBannerTextColor =
    topBannerTextColor ?? persistedTopBannerTextColor;
  const currentTopBannerBackgroundHexInput =
    topBannerBackgroundHexInput ?? currentTopBannerBackgroundColor;
  const currentTopBannerTextHexInput =
    topBannerTextHexInput ?? currentTopBannerTextColor;

  const currentHeader = {
    ...(config?.publicAppearance?.header ?? DEFAULT_HEADER),
    logoUrl:
      headerLogoUrl !== undefined
        ? headerLogoUrl
        : (config?.publicAppearance?.header?.logoUrl ?? null),
    text: headerText ?? (config?.publicAppearance?.header?.text ?? ""),
    backgroundColor:
      headerBackgroundColor ??
      (config?.publicAppearance?.header?.backgroundColor ??
        DEFAULT_HEADER.backgroundColor),
    textColor:
      headerTextColor ??
      (config?.publicAppearance?.header?.textColor ?? DEFAULT_HEADER.textColor),
  };

  const currentFooter = {
    ...(config?.publicAppearance?.footer ?? DEFAULT_FOOTER),
    logoUrl:
      footerLogoUrl !== undefined
        ? footerLogoUrl
        : (config?.publicAppearance?.footer?.logoUrl ?? null),
    text: footerText ?? (config?.publicAppearance?.footer?.text ?? ""),
    backgroundColor:
      footerBackgroundColor ??
      (config?.publicAppearance?.footer?.backgroundColor ??
        DEFAULT_FOOTER.backgroundColor),
    textColor:
      footerTextColor ??
      (config?.publicAppearance?.footer?.textColor ?? DEFAULT_FOOTER.textColor),
  };

  const previewBannerMessage = currentTopBannerMessage.trim()
    ? currentTopBannerMessage
    : DEFAULT_TOP_BANNER.message;

  const mutation = useMutation({
    mutationFn: updateBlogConfig,
    onSuccess: (updatedConfig) => {
      const updatedTopBanner =
        updatedConfig.publicAppearance?.topBanner ?? DEFAULT_TOP_BANNER;
      const normalizedBackgroundColor = resolveTopBannerColor(
        updatedTopBanner.backgroundColor,
        DEFAULT_TOP_BANNER.backgroundColor,
      );
      const normalizedTextColor = resolveTopBannerColor(
        updatedTopBanner.textColor,
        DEFAULT_TOP_BANNER.textColor,
      );
      setTopBannerEnabled(updatedTopBanner.enabled);
      setTopBannerMessage(updatedTopBanner.message);
      setTopBannerScope(updatedTopBanner.scope);
      setTopBannerBackgroundColor(normalizedBackgroundColor);
      setTopBannerTextColor(normalizedTextColor);
      setTopBannerBackgroundHexInput(normalizedBackgroundColor);
      setTopBannerTextHexInput(normalizedTextColor);
      setTopBannerBackgroundColorError(null);
      setTopBannerTextColorError(null);
      setHeaderLogoUrl(updatedConfig.publicAppearance?.header?.logoUrl ?? null);
      setHeaderText(updatedConfig.publicAppearance?.header?.text ?? "");
      setHeaderBackgroundColor(
        updatedConfig.publicAppearance?.header?.backgroundColor ??
          DEFAULT_HEADER.backgroundColor,
      );
      setHeaderTextColor(
        updatedConfig.publicAppearance?.header?.textColor ??
          DEFAULT_HEADER.textColor,
      );
      setFooterLogoUrl(updatedConfig.publicAppearance?.footer?.logoUrl ?? null);
      setFooterText(updatedConfig.publicAppearance?.footer?.text ?? "");
      setFooterBackgroundColor(
        updatedConfig.publicAppearance?.footer?.backgroundColor ??
          DEFAULT_FOOTER.backgroundColor,
      );
      setFooterTextColor(
        updatedConfig.publicAppearance?.footer?.textColor ??
          DEFAULT_FOOTER.textColor,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.blogConfig.all,
      });
      toast.success("Public shell settings updated");
    },
    onError: () => {
      toast.error("Failed to update settings");
    },
  });

  const handleLogoUpload = useCallback(
    async (section: "header" | "footer", event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }

      try {
        setUploadingSection(section);
        const uploaded = await uploadThemeLogo(file);
        if (section === "header") {
          setHeaderLogoUrl(uploaded.url);
        } else {
          setFooterLogoUrl(uploaded.url);
        }
        toast.success(
          section === "header"
            ? "Header logo uploaded"
            : "Footer logo uploaded",
        );
      } catch {
        toast.error("Failed to upload logo");
      } finally {
        setUploadingSection(null);
      }
    },
    [],
  );

  function handleSave() {
    const trimmedTopBannerMessage = currentTopBannerMessage.trim();
    const normalizedBackgroundColor = normalizeTopBannerHex(
      currentTopBannerBackgroundHexInput,
    );
    const normalizedTextColor = normalizeTopBannerHex(currentTopBannerTextHexInput);
    const hasBackgroundColorError =
      currentTopBannerEnabled && normalizedBackgroundColor === null;
    const hasTextColorError = currentTopBannerEnabled && normalizedTextColor === null;

    if (currentTopBannerEnabled && !trimmedTopBannerMessage) {
      toast.error("Banner message is required when the banner is enabled");
      return;
    }

    setTopBannerBackgroundColorError(
      hasBackgroundColorError
        ? "Background color must be a 6-digit hex code"
        : null,
    );
    setTopBannerTextColorError(
      hasTextColorError ? "Text color must be a 6-digit hex code" : null,
    );
    if (hasBackgroundColorError || hasTextColorError) {
      toast.error("Enter valid banner colors");
      return;
    }

    if (normalizedBackgroundColor !== null) {
      setTopBannerBackgroundColor(normalizedBackgroundColor);
      setTopBannerBackgroundHexInput(normalizedBackgroundColor);
    }
    if (normalizedTextColor !== null) {
      setTopBannerTextColor(normalizedTextColor);
      setTopBannerTextHexInput(normalizedTextColor);
    }

    mutation.mutate({
      publicAppearance: {
        themeMode: currentPublicThemeMode,
        topBanner: {
          enabled: currentTopBannerEnabled,
          message: trimmedTopBannerMessage,
          scope: currentTopBannerScope,
          backgroundColor:
            normalizedBackgroundColor ?? currentTopBannerBackgroundColor,
          textColor: normalizedTextColor ?? currentTopBannerTextColor,
        },
        header: currentHeader,
        footer: currentFooter,
      },
      homepage: {
        layout: currentLayout,
        postsPerPage: currentPostsPerPage,
        featuredCategory: currentFeaturedCategory || null,
      },
    });
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Theme", href: "/settings/theme" },
          { label: "Public Shell" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="p-6">
            <div className="pb-4 border-b border-border mb-6">
              <h3 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                Public Shell
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Configure the public header, footer, banner, and blog layout.
              </p>
            </div>

            {configLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-2">
                  <Label>Public Theme</Label>
                  <p className="text-xs text-muted-foreground">
                    Choose the default color mode for the public blog
                  </p>
                  <Select
                    value={currentPublicThemeMode}
                    onValueChange={setPublicThemeMode}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Light" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Homepage Layout</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {LAYOUT_OPTIONS.map((opt) => {
                      const isActive = currentLayout === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setLayout(opt.value)}
                          className={cn(
                            "relative rounded-lg border-2 p-4 text-left transition-colors",
                            isActive
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {opt.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postsPerPage">Posts Per Page</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="postsPerPage"
                      type="number"
                      min={1}
                      max={100}
                      value={currentPostsPerPage}
                      onChange={(e) =>
                        setPostsPerPage(parseInt(e.target.value, 10) || 12)
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      articles per page
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Featured Category</Label>
                  <p className="text-xs text-muted-foreground">
                    Highlight articles from this category on the homepage
                  </p>
                  <Select
                    value={currentFeaturedCategory}
                    onValueChange={(value) =>
                      setFeaturedCategory(value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug}>
                          {cat.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Header</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a logo, or leave the slot empty and show text instead.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="headerLogo">Header logo</Label>
                      <Input
                        id="headerLogo"
                        type="file"
                        accept="image/*"
                        onChange={(event) => void handleLogoUpload("header", event)}
                      />
                      {currentHeader.logoUrl ? (
                        <Image
                          src={currentHeader.logoUrl}
                          alt="Header logo preview"
                          width={220}
                          height={48}
                          unoptimized
                          className="h-12 w-auto max-w-[220px] rounded border border-border bg-card p-2 object-contain"
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setHeaderLogoUrl(null)}
                        disabled={uploadingSection === "header"}
                      >
                        Remove Header Logo
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="headerText">Header text</Label>
                        <Input
                          id="headerText"
                          value={currentHeader.text}
                          onChange={(event) => setHeaderText(event.target.value)}
                          placeholder="Acme"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="headerBackgroundColor">
                            Header background color
                          </Label>
                          <Input
                            id="headerBackgroundColor"
                            type="color"
                            value={currentHeader.backgroundColor}
                            onChange={(event) =>
                              setHeaderBackgroundColor(event.target.value)
                            }
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="headerTextColor">Header text color</Label>
                          <Input
                            id="headerTextColor"
                            type="color"
                            value={currentHeader.textColor}
                            onChange={(event) =>
                              setHeaderTextColor(event.target.value)
                            }
                            className="h-10"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <ShellPreview title="Header" appearance={currentHeader} />
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Footer</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a footer logo or configure a text fallback.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="footerLogo">Footer logo</Label>
                      <Input
                        id="footerLogo"
                        type="file"
                        accept="image/*"
                        onChange={(event) => void handleLogoUpload("footer", event)}
                      />
                      {currentFooter.logoUrl ? (
                        <Image
                          src={currentFooter.logoUrl}
                          alt="Footer logo preview"
                          width={220}
                          height={48}
                          unoptimized
                          className="h-12 w-auto max-w-[220px] rounded border border-border bg-card p-2 object-contain"
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFooterLogoUrl(null)}
                        disabled={uploadingSection === "footer"}
                      >
                        Remove Footer Logo
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="footerText">Footer text</Label>
                        <Input
                          id="footerText"
                          value={currentFooter.text}
                          onChange={(event) => setFooterText(event.target.value)}
                          placeholder="Acme Footer"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="footerBackgroundColor">
                            Footer background color
                          </Label>
                          <Input
                            id="footerBackgroundColor"
                            type="color"
                            value={currentFooter.backgroundColor}
                            onChange={(event) =>
                              setFooterBackgroundColor(event.target.value)
                            }
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="footerTextColor">Footer text color</Label>
                          <Input
                            id="footerTextColor"
                            type="color"
                            value={currentFooter.textColor}
                            onChange={(event) =>
                              setFooterTextColor(event.target.value)
                            }
                            className="h-10"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <ShellPreview title="Footer" appearance={currentFooter} />
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Top Banner</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure the AI disclosure banner shown on public pages
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="topBannerEnabled">Enable banner</Label>
                      <p className="text-xs text-muted-foreground">
                        Turn on a public disclosure strip above page content
                      </p>
                    </div>
                    <Switch
                      id="topBannerEnabled"
                      checked={currentTopBannerEnabled}
                      onCheckedChange={setTopBannerEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="topBannerMessage">Banner message</Label>
                    <Textarea
                      id="topBannerMessage"
                      value={currentTopBannerMessage}
                      onChange={(e) => setTopBannerMessage(e.target.value)}
                      rows={3}
                      maxLength={280}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="topBannerScope">Display on</Label>
                    <Select
                      value={currentTopBannerScope}
                      onValueChange={(value) =>
                        setTopBannerScope(value as PublicTopBannerConfig["scope"])
                      }
                    >
                      <SelectTrigger id="topBannerScope" className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homepage">Homepage only</SelectItem>
                        <SelectItem value="all">All public pages</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="topBannerBackgroundColor">
                        Background color
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="topBannerBackgroundColor"
                          type="color"
                          value={currentTopBannerBackgroundColor}
                          onChange={(e) => {
                            const normalized = resolveTopBannerColor(
                              e.target.value,
                              currentTopBannerBackgroundColor,
                            );
                            setTopBannerBackgroundColor(normalized);
                            setTopBannerBackgroundHexInput(normalized);
                            setTopBannerBackgroundColorError(null);
                          }}
                          className="h-10 w-16 p-1"
                        />
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="topBannerBackgroundColorHex">
                            Background color hex
                          </Label>
                          <Input
                            id="topBannerBackgroundColorHex"
                            type="text"
                            value={currentTopBannerBackgroundHexInput}
                            onChange={(e) => {
                              const value = e.target.value;
                              const normalized = normalizeTopBannerHex(value);
                              setTopBannerBackgroundHexInput(value);
                              if (normalized !== null) {
                                setTopBannerBackgroundColor(normalized);
                                setTopBannerBackgroundColorError(null);
                              }
                            }}
                          />
                        </div>
                      </div>
                      {topBannerBackgroundColorError ? (
                        <p className="text-xs text-destructive">
                          {topBannerBackgroundColorError}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="topBannerTextColor">Text color</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="topBannerTextColor"
                          type="color"
                          value={currentTopBannerTextColor}
                          onChange={(e) => {
                            const normalized = resolveTopBannerColor(
                              e.target.value,
                              currentTopBannerTextColor,
                            );
                            setTopBannerTextColor(normalized);
                            setTopBannerTextHexInput(normalized);
                            setTopBannerTextColorError(null);
                          }}
                          className="h-10 w-16 p-1"
                        />
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="topBannerTextColorHex">
                            Text color hex
                          </Label>
                          <Input
                            id="topBannerTextColorHex"
                            type="text"
                            value={currentTopBannerTextHexInput}
                            onChange={(e) => {
                              const value = e.target.value;
                              const normalized = normalizeTopBannerHex(value);
                              setTopBannerTextHexInput(value);
                              if (normalized !== null) {
                                setTopBannerTextColor(normalized);
                                setTopBannerTextColorError(null);
                              }
                            }}
                          />
                        </div>
                      </div>
                      {topBannerTextColorError ? (
                        <p className="text-xs text-destructive">
                          {topBannerTextColorError}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div
                      className="rounded-md px-3 py-2 text-sm"
                      style={{
                        backgroundColor: currentTopBannerBackgroundColor,
                        color: currentTopBannerTextColor,
                      }}
                    >
                      {previewBannerMessage}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={handleSave}
                    disabled={mutation.isPending || uploadingSection !== null}
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
