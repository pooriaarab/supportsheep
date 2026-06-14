import type { Article } from "@repo/types";
import { getArticlePath } from "@/lib/permalinks";
import {
  listPublishedArticles,
  getPublishedArticleBySlug as d1GetPublishedArticleBySlug,
} from "@/lib/articles/repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

export const PUBLIC_API_MAX_PAGE = 100;
export const PUBLIC_API_DEFAULT_LIMIT = 20;
export const PUBLIC_API_MAX_LIMIT = 50;

function parsePositiveInteger(raw: string | null, defaultValue: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue;
  }
  return Math.floor(parsed);
}

export function clampPublicPage(raw: string | null): number {
  const parsed = parsePositiveInteger(raw, 1);
  return Math.min(PUBLIC_API_MAX_PAGE, parsed);
}

export function clampPublicLimit(raw: string | null): number {
  const parsed = parsePositiveInteger(raw, PUBLIC_API_DEFAULT_LIMIT);
  return Math.min(PUBLIC_API_MAX_LIMIT, Math.max(1, parsed));
}

export function serializePublicArticleSummary(
  article: Pick<
    Article,
    | "title"
    | "slug"
    | "canonicalPath"
    | "excerpt"
    | "category"
    | "tags"
    | "publishedAt"
    | "updatedAt"
    | "readingTime"
  >,
  siteUrl: string,
) {
  return {
    title: article.title,
    slug: article.slug,
    url: `${siteUrl}${getArticlePath(article)}`,
    excerpt: article.excerpt || "",
    category: article.category,
    tags: article.tags,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    readingTime: article.readingTime,
  };
}

export function serializePublicArticleDetail(
  article: Pick<
    Article,
    | "title"
    | "slug"
    | "canonicalPath"
    | "excerpt"
    | "body"
    | "category"
    | "tags"
    | "author"
    | "publishedAt"
    | "updatedAt"
    | "readingTime"
    | "metaTitle"
    | "metaDescription"
  >,
  siteUrl: string,
) {
  return {
    ...serializePublicArticleSummary(article, siteUrl),
    body: article.body || "",
    author: article.author || "",
    metaTitle: article.metaTitle || "",
    metaDescription: article.metaDescription || "",
  };
}

type GetPublicArticlesInput = {
  page: number;
  limit: number;
  category?: string | null;
  tag?: string | null;
  blogId?: string;
};

export async function getPublishedPublicArticles({
  page,
  limit,
  category,
  tag,
  blogId = DEFAULT_BLOG_ID,
}: GetPublicArticlesInput) {
  const offset = (page - 1) * limit;
  return listPublishedArticles(blogId, {
    category: category ?? null,
    tag: tag ?? null,
    limit,
    offset,
  });
}

export async function getPublishedPublicArticleBySlug(
  slug: string,
  blogId: string = DEFAULT_BLOG_ID,
) {
  return d1GetPublishedArticleBySlug(blogId, slug);
}
