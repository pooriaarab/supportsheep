/**
 * MCP Article Tools
 *
 * Tools for searching, reading, listing, creating, and updating articles.
 */

import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";
import { buildArticleCreateDocument } from "@/lib/articles/create-article-record";
import { getBlogConfig } from "@/lib/blog-config";
import { preparePublishedArticleUpdate } from "@/lib/article-publish";
import { POST_TYPES, type Article, type FeaturedImage } from "@repo/types";
import {
  listArticles,
  createArticle,
  updateArticleBySlug,
  deleteArticleBySlug,
  slugExists,
} from "@/lib/articles/repository";
import { getArticleBySlug, textResult } from "./shared";
import type { McpToolContext } from "./context";

const postTypeSchema = z.enum(POST_TYPES);

const featuredImageSchema = z.object({
  url: z.string().max(2000).default(""),
  alt: z.string().max(500).default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase alphanumeric with single dashes",
  });

export function registerArticleTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool(
    "search_articles",
    "Search articles by query string (matches title)",
    {
      query: z
        .string()
        .describe("Search query to match against article titles"),
    },
    async ({ query }) => {
      const { articles } = await listArticles(blogId, {
        limit: 100,
        search: query,
      });

      const results = articles.slice(0, 20).map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        status: a.status,
        category: a.category,
        postType: a.postType,
      }));

      return textResult({ count: results.length, articles: results });
    },
  );

  server.tool(
    "get_article",
    "Get a single article by its slug",
    { slug: z.string().describe("Article slug") },
    async ({ slug }) => {
      const article = await getArticleBySlug(blogId, slug);
      if (!article) {
        return textResult({ error: "Article not found" });
      }
      return textResult(article);
    },
  );

  server.tool(
    "list_articles",
    "List articles with optional filters for status, category, and post type",
    {
      status: z
        .enum(["draft", "published", "scheduled", "archived"])
        .optional()
        .describe("Filter by status"),
      category: z.string().optional().describe("Filter by category slug"),
      postType: z.string().optional().describe("Filter by post type"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(25)
        .describe("Number of articles to return"),
    },
    async ({ status, category, postType, limit }) => {
      const { articles } = await listArticles(blogId, {
        status: status ?? null,
        category: category ?? null,
        postType: postType ?? null,
        limit,
      });

      const result = articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        status: a.status,
        category: a.category,
        postType: a.postType,
        wordCount: a.wordCount,
        seoScore: a.seoScore,
      }));

      return textResult({ count: result.length, articles: result });
    },
  );

  server.tool(
    "create_article",
    "Create a new blog article",
    {
      title: z.string().min(1).max(300).describe("Article title"),
      slug: slugSchema.optional().describe("Optional slug override"),
      body: z.string().default("").describe("Article body (HTML/markdown)"),
      draftBody: z.string().default("").describe("Draft body (HTML/markdown)"),
      excerpt: z.string().max(500).default("").describe("Short excerpt"),
      summary: z
        .string()
        .max(800)
        .default("")
        .describe("TL;DR summary shown above the article"),
      status: z
        .enum(["draft", "published", "scheduled", "archived"])
        .default("draft")
        .describe("Initial status"),
      category: z.string().max(100).default("").describe("Category slug"),
      primaryCategory: z.string().max(100).optional(),
      categories: z.array(z.string().max(100)).max(10).optional(),
      tags: z.array(z.string()).default([]).describe("Tags"),
      postType: postTypeSchema.default("blog_post").describe("Post type"),
      author: z.string().max(200).default(""),
      authorId: z.string().max(200).optional(),
      featuredImage: featuredImageSchema
        .default({ url: "", alt: "" })
        .describe("Featured image metadata"),
      ogImage: z.string().max(2000).default(""),
      metaTitle: z.string().max(200).default("").describe("SEO meta title"),
      metaDescription: z
        .string()
        .max(300)
        .default("")
        .describe("SEO meta description"),
      keywords: z.array(z.string()).default([]).describe("SEO keywords"),
    },
    async ({
      title,
      slug,
      body,
      draftBody,
      excerpt,
      summary,
      status,
      category,
      primaryCategory,
      categories,
      tags,
      postType,
      author,
      authorId,
      featuredImage,
      ogImage,
      metaTitle,
      metaDescription,
      keywords,
    }) => {
      const article = await buildArticleCreateDocument(
        {
          title,
          slugHint: slug,
          body,
          draftBody,
          excerpt,
          summary,
          status,
          category,
          primaryCategory,
          categories,
          tags,
          postType,
          author,
          authorId,
          featuredImage: featuredImage as FeaturedImage,
          ogImage,
          metaTitle,
          metaDescription,
          keywords,
          source: undefined,
        },
        async (candidateSlug) => slugExists(blogId, candidateSlug),
      );

      const result = await createArticle(blogId, {
        ...article,
        generatedBy: "manual",
      } as Article);

      if (!result.ok) {
        return textResult({ error: "Article slug already exists" });
      }

      return textResult({
        id: result.article.id,
        slug: result.article.slug,
        title: result.article.title,
        status: result.article.status,
      });
    },
  );

  server.tool(
    "update_article",
    "Update an existing article by slug",
    {
      slug: z.string().describe("Article slug to update"),
      newSlug: slugSchema.optional().describe("New slug for draft articles"),
      title: z.string().min(1).max(300).optional().describe("New title"),
      body: z.string().optional().describe("New body content"),
      draftBody: z.string().optional().describe("New draft body content"),
      excerpt: z.string().max(500).optional().describe("New excerpt"),
      summary: z.string().max(800).optional().describe("New TL;DR summary"),
      category: z.string().max(100).optional().describe("New category slug"),
      primaryCategory: z.string().max(100).optional(),
      categories: z.array(z.string().max(100)).max(10).optional(),
      tags: z.array(z.string()).optional().describe("New tags"),
      author: z.string().max(200).optional(),
      authorId: z.string().max(200).nullable().optional(),
      featuredImage: featuredImageSchema.optional(),
      ogImage: z.string().max(2000).optional(),
      metaTitle: z.string().max(200).optional().describe("New SEO meta title"),
      metaDescription: z
        .string()
        .max(300)
        .optional()
        .describe("New SEO meta description"),
      keywords: z.array(z.string()).optional().describe("New SEO keywords"),
      status: z
        .enum(["draft", "published", "scheduled", "archived"])
        .optional()
        .describe("New status"),
      postType: postTypeSchema.optional().describe("New post type"),
    },
    async ({ slug, ...updates }) => {
      const article = await getArticleBySlug(blogId, slug);
      if (!article) {
        return textResult({ error: "Article not found" });
      }

      const patch: Partial<Article> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          const patchKey = key === "newSlug" ? "slug" : key;
          (patch as Record<string, unknown>)[patchKey] = value;
        }
      }

      if (patch.slug && patch.slug !== article.slug) {
        if (article.status !== "draft") {
          return textResult({
            error: "Slug can only be changed while an article is a draft",
          });
        }
        const exists = await slugExists(blogId, patch.slug);
        if (exists && patch.slug !== article.slug) {
          return textResult({ error: "Article slug already exists" });
        }
      }

      if (patch.body) {
        const sanitizedBody = sanitizeArticleHtml(String(patch.body));
        patch.body = sanitizedBody;
        const wordCount = sanitizedBody.split(/\s+/).filter(Boolean).length;
        patch.wordCount = wordCount;
        patch.readingTime = Math.max(1, Math.ceil(wordCount / 200));
      }
      if (patch.draftBody) {
        patch.draftBody = sanitizeArticleHtml(String(patch.draftBody));
      }

      const updated = await updateArticleBySlug(blogId, slug, patch);
      if (!updated) return textResult({ error: "Article not found" });

      return textResult(updated);
    },
  );

  server.tool(
    "save_article_draft",
    "Save draft body and append a version entry for an article",
    {
      slug: z.string().describe("Article slug"),
      draftBody: z.string().describe("Draft body content"),
      note: z.string().max(200).default("").describe("Version note"),
    },
    async ({ slug, draftBody, note }) => {
      const article = await getArticleBySlug(blogId, slug);
      if (!article) return textResult({ error: "Article not found" });

      const versions = Array.isArray(article.versions) ? article.versions : [];
      const sanitizedDraft = sanitizeArticleHtml(draftBody);

      const updated = await updateArticleBySlug(blogId, slug, {
        draftBody: sanitizedDraft,
        versions: [
          ...versions,
          {
            body: sanitizedDraft,
            savedAt: new Date().toISOString(),
            note,
          },
        ],
      });
      if (!updated) return textResult({ error: "Article not found" });

      return textResult(updated);
    },
  );

  server.tool(
    "publish_article",
    "Publish an article by slug",
    { slug: z.string().describe("Article slug") },
    async ({ slug }) => {
      const article = await getArticleBySlug(blogId, slug);
      if (!article) return textResult({ error: "Article not found" });

      const config = await getBlogConfig(blogId);
      const prepared = await preparePublishedArticleUpdate({
        article: {
          slug: String(article.slug || ""),
          category: String(article.category || ""),
          canonicalPath:
            typeof article.canonicalPath === "string"
              ? String(article.canonicalPath)
              : undefined,
          body: String(article.body || ""),
          draftBody: String(article.draftBody || ""),
          submissionStatus: article.submissionStatus as Article["submissionStatus"],
        },
        config,
      });

      const updated = await updateArticleBySlug(blogId, slug, {
        body: prepared.body,
        status: "published",
        publishedAt: new Date().toISOString(),
        wordCount: prepared.wordCount,
        readingTime: prepared.readingTime,
        submissionStatus: prepared.submissionStatus,
      });
      if (!updated) return textResult({ error: "Article not found" });

      return textResult(updated);
    },
  );

  server.tool(
    "schedule_article",
    "Schedule an article for future publication",
    {
      slug: z.string().describe("Article slug"),
      scheduledAt: z.string().datetime().describe("ISO datetime"),
    },
    async ({ slug, scheduledAt }) => {
      const article = await getArticleBySlug(blogId, slug);
      if (!article) return textResult({ error: "Article not found" });

      const updated = await updateArticleBySlug(blogId, slug, {
        status: "scheduled",
        scheduledAt,
      });
      if (!updated) return textResult({ error: "Article not found" });

      return textResult(updated);
    },
  );

  server.tool(
    "unpublish_article",
    "Move a published or scheduled article back to draft",
    { slug: z.string().describe("Article slug") },
    async ({ slug }) => {
      const article = await getArticleBySlug(blogId, slug);
      if (!article) return textResult({ error: "Article not found" });

      const updated = await updateArticleBySlug(blogId, slug, {
        status: "draft",
      });
      if (!updated) return textResult({ error: "Article not found" });

      return textResult(updated);
    },
  );

  server.tool(
    "delete_article",
    "Delete an article by slug",
    { slug: z.string().describe("Article slug") },
    async ({ slug }) => {
      const article = await getArticleBySlug(blogId, slug);
      if (!article) return textResult({ error: "Article not found" });

      await deleteArticleBySlug(blogId, slug);
      return textResult({ deleted: true, slug });
    },
  );
}
