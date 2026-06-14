/**
 * RSS/Atom Feed
 *
 * GET /api/feed
 * Generates an RSS 2.0 feed from published articles.
 */

import { NextResponse } from "next/server";
import { getBlogConfig } from "@/lib/blog-config";
import { getArticlePath } from "@/lib/permalinks";
import {
  normalizePublicAuthor,
  normalizePublicBlogConfig,
  normalizePublicDateValue,
} from "@/lib/public-content";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";
import { listPublishedArticles } from "@/lib/articles/repository";
import type { Article } from "@repo/types";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const blogId = await getRequestBlogId();
  const config = normalizePublicBlogConfig(await getBlogConfig(blogId));
  const siteUrl = resolvePublicSiteUrl();
  let articles: Array<Article & { id: string }> = [];

  try {
    ({ articles } = await listPublishedArticles(blogId, { limit: 50 }));
  } catch {
    articles = [];
  }

  const items = articles
    .map((article) => {
      const normalizedPublishedAt =
        normalizePublicDateValue(article.publishedAt) ??
        normalizePublicDateValue(article.createdAt);
      const pubDate = normalizedPublishedAt
        ? new Date(normalizedPublishedAt).toUTCString()
        : new Date().toUTCString();
      const link = `${siteUrl}${getArticlePath(article)}`;

      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(article.excerpt || article.metaDescription || "")}</description>
      <category>${escapeXml(article.category)}</category>
      <author>${escapeXml(normalizePublicAuthor(article.author))}</author>
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.siteName)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(config.siteDescription)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/feed" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
