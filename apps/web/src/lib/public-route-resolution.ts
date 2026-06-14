import type {
  Article,
  Author,
  CategoryEntry,
} from "@repo/types";
import { createLogger } from "@/lib/logger";
import {
  getArticleCategories,
  getPrimaryCategory,
  normalizeCategorySegment,
} from "@/lib/permalinks";
import {
  getPublishedArticleBySlug as d1GetPublishedArticleBySlug,
  getRelatedArticles as d1GetRelatedArticles,
  listPublishedArticlesByCategory,
  listPublishedArticlesByAuthor,
} from "@/lib/articles/repository";
import { listCategories } from "@/lib/categories/repository";
import { getAuthor, listAuthors } from "@/lib/authors/repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

const routeResolutionLogger = createLogger("lib:public-route-resolution");

export type LegacyBlogPathResolution =
  | { kind: "article-redirect"; destination: string }
  | { kind: "category-redirect"; destination: string };

export function resolveLegacyBlogPath(input: {
  categorySegment: string;
  slugSegment?: string;
  article?: { slug: string; category: string; canonicalPath?: string };
}): LegacyBlogPathResolution {
  if (input.article && input.slugSegment) {
    return {
      kind: "article-redirect",
      destination: input.article.canonicalPath || `/${input.article.slug}`,
    };
  }

  return {
    kind: "category-redirect",
    destination: `/category/${input.categorySegment}`,
  };
}

export async function getPublicArticleBySlug(
  slug: string,
  blogId: string = DEFAULT_BLOG_ID,
): Promise<(Article & { id: string }) | null> {
  return d1GetPublishedArticleBySlug(blogId, slug);
}

export async function getRelatedPublicArticles(
  article: { id: string; slug: string } & Pick<Article, "category"> & {
      primaryCategory?: string;
      categories?: string[];
    },
  blogId: string = DEFAULT_BLOG_ID,
): Promise<(Article & { id: string })[]> {
  const primary = getPrimaryCategory(article);
  const all = getArticleCategories(article);
  if (!primary && all.length === 0) return [];

  try {
    return await d1GetRelatedArticles(blogId, {
      // Exclude the current article by SLUG — the repo excludes on the slug
      // column; `article.id` is the nanoid row id and would never match.
      excludeSlug: article.slug,
      category: primary ?? null,
      legacyCategory: article.category ?? null,
      // Secondary-category overlap source — parity with the old
      // `categories array-contains-any` query.
      categories: all,
      limit: 3,
    });
  } catch (error) {
    routeResolutionLogger.error(
      "getRelatedPublicArticles failed; omitting related articles",
      {
        articleId: article.id,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return [];
  }
}

export async function getPublicCategories(
  blogId: string = DEFAULT_BLOG_ID,
): Promise<Array<CategoryEntry & { slug: string }>> {
  try {
    return await listCategories(blogId);
  } catch {
    return [];
  }
}

export async function getPublicCategoryInfo(
  slug: string,
  blogId: string = DEFAULT_BLOG_ID,
): Promise<{
  slug: string;
  displayName: string;
  description: string;
  order: number;
  icon: string;
  postCount: number;
} | null> {
  try {
    const all = await listCategories(blogId);
    return all.find((c) => c.slug === slug) ?? null;
  } catch {
    return null;
  }
}

export async function getPublicCategoryArticles(
  category: {
    slug: string;
    displayName: string;
  },
  page: number,
  perPage: number,
  blogId: string = DEFAULT_BLOG_ID,
) {
  return listPublishedArticlesByCategory(blogId, {
    categorySlug: category.slug,
    categoryDisplayName: category.displayName,
    page,
    perPage,
  });
}

export function resolveCategorySlug(category: string): string {
  return normalizeCategorySegment(category);
}

/**
 * Fetch an author by slug for the public author archive. Returns `null` when
 * no matching document exists so callers can render a 404.
 */
export async function getPublicAuthorBySlug(
  slug: string,
  blogId: string = DEFAULT_BLOG_ID,
): Promise<Author | null> {
  const entry = await getAuthor(blogId, slug);
  if (!entry) return null;
  // Map AuthorEntry → Author (@repo/types)
  return {
    id: entry.id,
    name: entry.name,
    jobTitle: entry.jobTitle || undefined,
    bio: entry.bio,
    avatarUrl: entry.avatarUrl || undefined,
    email: entry.email || undefined,
    sameAs: entry.sameAs.length > 0 ? entry.sameAs : undefined,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/**
 * List every author used as a static param source for `/authors/{slug}`.
 * Returns an empty list when D1 is unavailable (e.g. during CI build).
 */
export async function getAllPublicAuthors(
  blogId: string = DEFAULT_BLOG_ID,
): Promise<Author[]> {
  try {
    const entries = await listAuthors(blogId);
    return entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      jobTitle: entry.jobTitle || undefined,
      bio: entry.bio,
      avatarUrl: entry.avatarUrl || undefined,
      email: entry.email || undefined,
      sameAs: entry.sameAs.length > 0 ? entry.sameAs : undefined,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch every published article authored by the given author id, newest first.
 */
export async function getPublicAuthorArticles(
  authorId: string,
  limit = 50,
  blogId: string = DEFAULT_BLOG_ID,
): Promise<(Article & { id: string })[]> {
  try {
    return await listPublishedArticlesByAuthor(blogId, authorId, limit);
  } catch (error) {
    routeResolutionLogger.error(
      "getPublicAuthorArticles failed; omitting author archive articles",
      {
        authorId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return [];
  }
}
