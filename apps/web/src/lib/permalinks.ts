import type {
  Article,
  BlogConfig,
  PermalinkPattern,
  PermalinkSettings,
} from "@repo/types";

export type SupportedPermalinkPattern = PermalinkPattern;

export const RESERVED_ROOT_SLUGS = new Set([
  "",
  "api",
  "ai",
  "apple-touch-icon.png",
  "authors",
  "blog",
  "categories",
  "category",
  "contact",
  "dashboard",
  "docs",
  "favicon.png",
  "favicon.svg",
  "generate",
  "guides",
  "llms-full.txt",
  "llms-articles.txt",
  "llms.txt",
  "login",
  "manifest.webmanifest",
  "media",
  "posts",
  "robots.txt",
  "search",
  "seo",
  "settings",
  "sitemap.xml",
  "users",
  "writing",
]);

export const DEFAULT_PERMALINK_SETTINGS: PermalinkSettings = {
  canonicalPattern: "/<slug>/",
  redirectOldPatterns: true,
  allowedPatterns: [
    "/<slug>/",
    "/<category>/<slug>/",
    "/blog/<slug>/",
    "/blog/<category>/<slug>/",
  ],
};

const SUPPORTED_CANONICAL_PATTERNS = new Set<PermalinkPattern>(["/<slug>/"]);

export function getPermalinkSettings(
  config?: Pick<BlogConfig, "permalinks"> | null,
): PermalinkSettings {
  if (!config?.permalinks) {
    return DEFAULT_PERMALINK_SETTINGS;
  }

  const merged = {
    ...DEFAULT_PERMALINK_SETTINGS,
    ...config.permalinks,
  };

  return {
    ...merged,
    canonicalPattern: SUPPORTED_CANONICAL_PATTERNS.has(merged.canonicalPattern)
      ? merged.canonicalPattern
      : DEFAULT_PERMALINK_SETTINGS.canonicalPattern,
  };
}

export function isReservedRootSlug(slug: string): boolean {
  return RESERVED_ROOT_SLUGS.has(slug.trim().toLowerCase());
}

export function renderPattern(
  pattern: PermalinkPattern,
  values: { slug: string; category: string },
): string {
  const category = normalizeCategorySegment(values.category);

  return (
    pattern
      .replace("<category>", category)
      .replace("<slug>", values.slug)
      .replace(/\/+/g, "/")
      .replace(/\/$/, "") || "/"
  );
}

export function buildArticlePaths(
  values: { slug: string; category: string },
  settings: PermalinkSettings,
): { canonicalPath: string; legacyPaths: string[] } {
  const canonicalPath = renderPattern(settings.canonicalPattern, values);
  const legacyPaths = settings.allowedPatterns.flatMap((pattern) =>
    pattern === settings.canonicalPattern ? [] : [renderPattern(pattern, values)],
  );

  return {
    canonicalPath,
    legacyPaths: [...new Set(legacyPaths)],
  };
}

export function getArticlePath(
  article: Pick<Article, "slug" | "category" | "canonicalPath">,
): string {
  return article.canonicalPath || renderPattern("/<slug>/", article);
}

export function normalizeCategorySegment(category: string): string {
  return (
    category
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "uncategorized"
  );
}

export function getCategoryPath(category: string): string {
  return `/category/${normalizeCategorySegment(category)}`;
}

/**
 * Resolve the effective primary category for an article, preferring the new
 * `primaryCategory` field and falling back to the legacy `category` field for
 * documents that have not yet been migrated.
 */
export function getPrimaryCategory(
  article: Pick<Article, "category"> & {
    primaryCategory?: string;
  },
): string {
  const primary = article.primaryCategory?.trim();
  if (primary) return primary;
  return article.category || "";
}

/**
 * Resolve the full list of category slugs for an article. Always includes the
 * primary category first and falls back to `[category]` for legacy documents.
 */
export function getArticleCategories(
  article: Pick<Article, "category"> & {
    primaryCategory?: string;
    categories?: string[];
  },
): string[] {
  if (Array.isArray(article.categories) && article.categories.length > 0) {
    return article.categories;
  }
  const primary = getPrimaryCategory(article);
  return primary ? [primary] : [];
}
