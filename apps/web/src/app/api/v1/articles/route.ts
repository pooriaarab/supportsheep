/**
 * Articles API
 *
 * GET /api/v1/articles -- List articles (paginated, filterable)
 * POST /api/v1/articles -- Create a new article
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { createArticleSchema } from "@/lib/schemas";
import { buildArticleCreateDocument } from "@/lib/articles/create-article-record";
import {
  listArticles,
  createArticle,
  slugExists,
} from "@/lib/articles/repository";

/**
 * GET /api/v1/articles
 * List articles with pagination, filtering by status/category/postType, and search
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ request, blogId }) => {
    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50"),
      100,
    );
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    const postType = url.searchParams.get("postType");
    const search = url.searchParams.get("search");
    const orderBy = url.searchParams.get("orderBy") || "updatedAt";
    const orderDir =
      url.searchParams.get("orderDir") === "asc" ? "asc" : "desc";
    const startAfter = url.searchParams.get("startAfter");

    const result = await listArticles(blogId, {
      status,
      category,
      postType,
      orderBy,
      orderDir,
      limit,
      startAfter,
      search,
    });

    return NextResponse.json({
      data: result.articles,
      pagination: {
        limit,
        count: result.articles.length,
        hasMore: result.hasMore,
      },
    });
  },
});

/**
 * POST /api/v1/articles
 * Create a new article with a unique slug derived from the title
 */
export const POST = createApiHandler({
  auth: "user",
  input: createArticleSchema,
  audit: "create_article",
  handler: async ({ body, blogId }) => {
    const article = await buildArticleCreateDocument(
      body,
      (slug) => slugExists(blogId, slug),
    );

    // Override blogId in case buildArticleCreateDocument hardcodes "default"
    const result = await createArticle(blogId, { ...article, blogId });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Article slug already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { id: result.article.id, slug: result.article.slug },
      { status: 201 },
    );
  },
});
