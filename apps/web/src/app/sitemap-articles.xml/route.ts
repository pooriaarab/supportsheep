/**
 * Sub-sitemap: published blog articles.
 *
 * Emits one `<url>` per published article, plus the homepage and `/blog`
 * index as anchor entries so the sitemap is never empty when no articles
 * exist.
 */

import { NextResponse } from "next/server";
import { listPublishedArticles } from "@/lib/articles/repository";
import { getArticlePath } from "@/lib/permalinks";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";
import {
  buildUrlset,
  xmlResponseHeaders,
  type SitemapUrl,
} from "@/lib/sitemap-xml";

// TODO(M5-cache): path-keyed ISR (`revalidate`). Make the cache key host-aware
// before serving distinct tenants on `{slug}.blogbat.com`.
export const revalidate = 3600;

function toLastmod(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

export async function GET(): Promise<NextResponse> {
  const siteUrl = resolvePublicSiteUrl();
  const urls: SitemapUrl[] = [
    {
      loc: siteUrl,
      lastmod: new Date(),
      changefreq: "monthly",
      priority: 1.0,
    },
    {
      loc: `${siteUrl}/blog`,
      lastmod: new Date(),
      changefreq: "daily",
      priority: 0.9,
    },
    {
      loc: `${siteUrl}/guest-post`,
      lastmod: new Date(),
      changefreq: "monthly",
      priority: 0.5,
    },
  ];

  try {
    const blogId = await getRequestBlogId();
    const { articles } = await listPublishedArticles(blogId, { limit: 1000 });
    for (const article of articles) {
      urls.push({
        loc: `${siteUrl}${getArticlePath(article)}`,
        lastmod: toLastmod(article.updatedAt, article.createdAt),
        changefreq: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // D1 may not be available during build
  }

  return new NextResponse(buildUrlset(urls), { headers: xmlResponseHeaders() });
}
