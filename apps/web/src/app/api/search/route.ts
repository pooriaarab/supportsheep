/**
 * Search API
 *
 * GET /api/search?q=<query>
 * Searches published articles by title, body, tags, and keywords.
 * Returns matched articles with excerpts. No auth required.
 */

import { NextResponse, type NextRequest } from "next/server";
import { listPublishedArticles } from "@/lib/articles/repository";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const lowerQ = q.toLowerCase();
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "20", 10),
    50,
  );

  // D1 does not support full-text search, so we fetch recent published
  // articles and filter in memory. For production, consider Algolia/Typesense.
  const blogId = await getRequestBlogId();
  const { articles: allArticles } = await listPublishedArticles(blogId, {
    limit: 200,
  });

  const results: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    category: string;
    publishedAt: string | null;
    author: string;
    readingTime: number;
    featuredImage: string;
    featuredImageAlt: string;
  }> = [];

  for (const data of allArticles) {
    if (results.length >= limit) break;

    const titleMatch = data.title?.toLowerCase().includes(lowerQ);
    const bodyMatch = data.body?.toLowerCase().includes(lowerQ);
    const excerptMatch = data.excerpt?.toLowerCase().includes(lowerQ);
    const tagMatch = data.tags?.some((t) => t.toLowerCase().includes(lowerQ));
    const keywordMatch = data.keywords?.some((k) =>
      k.toLowerCase().includes(lowerQ),
    );

    if (titleMatch || bodyMatch || excerptMatch || tagMatch || keywordMatch) {
      // Generate a context-aware excerpt around the match
      let matchExcerpt = data.excerpt || "";
      if (bodyMatch && !titleMatch) {
        const bodyLower = data.body.toLowerCase();
        const idx = bodyLower.indexOf(lowerQ);
        if (idx !== -1) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(data.body.length, idx + lowerQ.length + 80);
          const rawText = data.body.slice(start, end).replace(/<[^>]*>/g, "");
          matchExcerpt =
            (start > 0 ? "..." : "") +
            rawText +
            (end < data.body.length ? "..." : "");
        }
      }

      results.push({
        id: data.id,
        title: data.title,
        slug: data.slug,
        excerpt: matchExcerpt,
        category: data.category,
        publishedAt: data.publishedAt ?? null,
        author: data.author,
        readingTime: data.readingTime,
        featuredImage: data.featuredImage?.url ?? "",
        featuredImageAlt: data.featuredImage?.alt || data.title,
      });
    }
  }

  return NextResponse.json({ data: results });
}
