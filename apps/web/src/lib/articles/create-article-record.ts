import "server-only";

import type { Article, ArticleStatus, FeaturedImage, PostType } from "@repo/types";
import { getDefaultIndexNowSubmissionStatus } from "@/lib/seo/indexnow";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";

interface BuildArticleCreateDocumentInput {
  title: string;
  body?: string;
  draftBody?: string;
  excerpt?: string;
  summary?: string;
  status?: ArticleStatus;
  postType?: PostType;
  category?: string;
  primaryCategory?: string;
  categories?: string[];
  tags?: string[];
  author?: string;
  authorId?: string;
  featuredImage?: FeaturedImage;
  ogImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  slugHint?: string;
  source?: Article["source"];
}

type SlugExists = (slug: string) => Promise<boolean>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function resolveUniqueSlug(baseSlug: string, slugExists: SlugExists) {
  const fallbackBase = baseSlug || `article-${Date.now().toString(36)}`;
  let attempt = 0;
  let slug = fallbackBase;

  while (await slugExists(slug)) {
    attempt += 1;
    const suffix = `-${attempt.toString(36)}`;
    const trimmedBase = fallbackBase.slice(0, Math.max(1, 80 - suffix.length));
    slug = `${trimmedBase}${suffix}`;
  }

  return slug;
}

export async function buildArticleCreateDocument(
  input: BuildArticleCreateDocumentInput,
  slugExists: SlugExists,
): Promise<Article> {
  const status = input.status ?? "draft";
  const now = new Date().toISOString();
  const body = sanitizeArticleHtml(input.body || "");
  const draftBody = sanitizeArticleHtml(input.draftBody || "");
  const slug = await resolveUniqueSlug(
    slugify(input.slugHint || input.title),
    slugExists,
  );
  const wordCount = (body || draftBody).split(/\s+/).filter(Boolean).length;

  return {
    blogId: "default",
    title: input.title,
    slug,
    body,
    draftBody,
    excerpt: input.excerpt || "",
    summary: input.summary || "",
    status,
    scheduledAt: null,
    publishedAt: status === "published" ? now : null,
    postType: input.postType || "blog_post",
    category: input.category || "",
    primaryCategory: input.primaryCategory,
    categories: input.categories,
    tags: input.tags || [],
    author: input.author || "",
    authorId: input.authorId,
    featuredImage: input.featuredImage || { url: "", alt: "" },
    ogImage: input.ogImage || "",
    metaTitle: input.metaTitle || "",
    metaDescription: input.metaDescription || "",
    keywords: input.keywords || [],
    seoScore: 0,
    internalLinks: [],
    externalLinks: [],
    versions: [],
    generatedBy: "manual",
    generationMeta: null,
    source: input.source,
    submissionStatus: {
      indexNow: getDefaultIndexNowSubmissionStatus(),
    },
    wordCount,
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    createdAt: now,
    updatedAt: now,
  };
}
