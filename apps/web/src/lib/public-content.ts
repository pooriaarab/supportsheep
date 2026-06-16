import type { BlogConfig } from "@repo/types";

export const DEFAULT_PUBLIC_SITE_NAME = "Supportsheep";
export const DEFAULT_PUBLIC_SITE_DESCRIPTION =
  "Practical guides on building and ranking a small business website with Supportsheep's AI-powered tools.";

function isPlaceholderSiteName(value: string | null | undefined): boolean {
  return !value || value.trim() === "" || value.trim() === "Blog";
}

function isPlaceholderSiteDescription(
  value: string | null | undefined,
): boolean {
  return (
    !value || value.trim() === "" || value.trim() === "A modern support portal"
  );
}

export function normalizePublicAuthor(author?: string | null): string {
  const value = typeof author === "string" ? author.trim() : "";
  return !value || value.toLowerCase() === "blogsupportsheepai"
    ? "Supportsheep"
    : value;
}

export function normalizePublicDateValue(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }

    if ("seconds" in value && typeof value.seconds === "number") {
      return new Date(value.seconds * 1000).toISOString();
    }

    if ("_seconds" in value && typeof value._seconds === "number") {
      return new Date(value._seconds * 1000).toISOString();
    }
  }

  return null;
}

export function normalizePublicBlogConfig(config: BlogConfig): BlogConfig {
  const siteName = isPlaceholderSiteName(config.siteName)
    ? DEFAULT_PUBLIC_SITE_NAME
    : config.siteName;
  const siteDescription = isPlaceholderSiteDescription(config.siteDescription)
    ? DEFAULT_PUBLIC_SITE_DESCRIPTION
    : config.siteDescription;
  const seo = config.seo ?? {
    defaultMetaTitle: "",
    defaultMetaDescription: "",
    googleAnalyticsId: "",
    clarityId: "",
  };

  return {
    ...config,
    siteName,
    siteDescription,
    seo: {
      ...seo,
      defaultMetaTitle: isPlaceholderSiteName(seo.defaultMetaTitle)
        ? siteName
        : seo.defaultMetaTitle,
      defaultMetaDescription: isPlaceholderSiteDescription(
        seo.defaultMetaDescription,
      )
        ? siteDescription
        : seo.defaultMetaDescription,
    },
  };
}
