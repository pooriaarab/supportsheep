/**
 * Bulk Articles API
 *
 * POST /api/v1/articles/bulk -- Bulk create articles
 * DELETE /api/v1/articles/bulk -- Bulk delete articles by slugs
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";
import { createArticleSchema, bulkDeleteArticlesSchema } from "@/lib/schemas";
import {
  createArticle,
  bulkDeleteArticles,
  slugExists,
} from "@/lib/articles/repository";
import type { Article } from "@repo/types";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const bulkCreateSchema = z.object({
  articles: z.array(createArticleSchema).min(1).max(50),
});

/**
 * POST /api/v1/articles/bulk
 * Create multiple articles in a single batch
 */
export const POST = createApiHandler({
  auth: "user",
  input: bulkCreateSchema,
  audit: "create_article",
  handler: async ({ body, blogId }) => {
    const results: { slug: string; id: string }[] = [];

    for (const articleInput of body.articles) {
      let slug = generateSlug(articleInput.title);

      if (await slugExists(blogId, slug)) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const sanitizedBody = sanitizeArticleHtml(articleInput.body || "");
      const sanitizedDraftBody = sanitizeArticleHtml(articleInput.draftBody || "");

      const wordCount = (sanitizedBody || sanitizedDraftBody || "")
        .split(/\s+/)
        .filter(Boolean).length;

      const now = new Date().toISOString();
      const article: Article = {
        blogId,
        title: articleInput.title,
        slug,
        body: sanitizedBody,
        draftBody: sanitizedDraftBody,
        excerpt: articleInput.excerpt || "",
        summary: articleInput.summary || "",
        status: articleInput.status ?? "draft",
        scheduledAt: null,
        publishedAt: null,
        postType: articleInput.postType ?? "blog_post",
        category: articleInput.category || "",
        primaryCategory: articleInput.primaryCategory,
        categories: articleInput.categories,
        tags: articleInput.tags || [],
        author: articleInput.author || "",
        authorId: articleInput.authorId,
        featuredImage: articleInput.featuredImage || { url: "", alt: "" },
        ogImage: articleInput.ogImage || "",
        metaTitle: articleInput.metaTitle || "",
        metaDescription: articleInput.metaDescription || "",
        keywords: articleInput.keywords || [],
        seoScore: 0,
        internalLinks: [],
        externalLinks: [],
        versions: [],
        generatedBy: "manual",
        generationMeta: null,
        wordCount,
        readingTime: Math.max(1, Math.ceil(wordCount / 200)),
        createdAt: now,
        updatedAt: now,
      };

      const result = await createArticle(blogId, article);
      if (result.ok) {
        results.push({ slug: result.article.slug, id: result.article.id });
      }
      // If duplicate (race condition), skip silently to preserve existing behavior
    }

    return NextResponse.json({ created: results }, { status: 201 });
  },
});

/**
 * DELETE /api/v1/articles/bulk
 * Delete multiple articles by slugs
 */
export const DELETE = createApiHandler({
  auth: "user",
  input: bulkDeleteArticlesSchema,
  audit: "delete_article",
  handler: async ({ body, blogId }) => {
    const { slugs } = body;
    const deleteCount = await bulkDeleteArticles(blogId, slugs);
    return NextResponse.json({ deleted: deleteCount });
  },
});
